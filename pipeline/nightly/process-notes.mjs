// 「解説待ち」の記録を処理する：プレート写真から作品を読み取り、DB の作品に紐づけるか、新しい作品ページを作る。
import { hasClaude, imageB64, jsonCall } from './claude.mjs';
import { generateEntry } from './entry.mjs';
import { existingKeys, read, readIf, slug, supabase, today, uniqueId, write, factsOf } from './common.mjs';
import { SOURCES } from '../lib/sources.mjs';
import { matches, norm } from '../lib/match.mjs';

const MAX_NOTES = Number(process.env.NIGHTLY_MAX_NOTES || 30);
const CONFIDENT = 0.6;

const EXTRACT_SYSTEM = `あなたは美術館の解説プレート（キャプション）と作品写真を読み取るアシスタントです。
画像に写っている文字をできるだけ正確に読み取り、作品を特定するための情報を JSON で返します。
- title: プレートに書かれた作品名（原語。英語表記があれば英語も含めてよい）
- title_ja: 日本語の作品名（プレートにあればそれ、なければ空文字）
- artist / date / technique / collection（所蔵・寄託先）/ culture（国・文化）：読み取れたもの。読めなければ空文字
- year_start / year_end: 制作年の範囲（西暦。紀元前は負の数。不明なら 0 と 0）
- confidence: 作品名と作家を正しく特定できた確信度（0〜1）。文字がぼやけている、プレートが写っていない、複数作品のプレートが混在する場合は低くする
- candidates: 確信度が低い場合に考えられる作品候補（最大3件。title, artist, note）。確信度が高い場合は空配列でよい
ユーザーのメモがあれば参考にする。推測で作品名を創作しないこと。`;

const EXTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'title_ja', 'artist', 'date', 'technique', 'collection', 'culture', 'year_start', 'year_end', 'confidence', 'candidates'],
  properties: {
    title: { type: 'string' }, title_ja: { type: 'string' }, artist: { type: 'string' }, date: { type: 'string' },
    technique: { type: 'string' }, collection: { type: 'string' }, culture: { type: 'string' },
    year_start: { type: 'integer' }, year_end: { type: 'integer' }, confidence: { type: 'number' },
    candidates: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, required: ['title', 'artist', 'note'], properties: { title: { type: 'string' }, artist: { type: 'string' }, note: { type: 'string' } } },
    },
  },
};

async function download(path) {
  const { data, error } = await supabase.storage.from('photos').download(path);
  if (error) throw new Error(`写真を取得できません: ${error.message}`);
  return Buffer.from(await data.arrayBuffer()).toString('base64');
}

/** 既存の作品 DB から一致するものを探す（題名と作家の照合） */
export function findInDb(artworks, ex) {
  const titles = [ex.title, ex.title_ja].map(norm).filter((t) => t.length >= 2);
  const artist = norm(ex.artist);
  const scored = artworks
    .map((a) => {
      const names = [a.facts.title, a.title_ja, a.ai?.title_ja].map(norm);
      const t = titles.some((x) => names.some((n) => n && (n.includes(x) || x.includes(n)))) ? 1 : 0;
      const tokens = new Set(titles.join(' ').split(' ').filter((w) => w.length > 2));
      const overlap = tokens.size ? [...tokens].filter((w) => names.join(' ').includes(w)).length / tokens.size : 0;
      const who = norm(a.facts.artist);
      const art = artist && who ? (who.includes(artist.split(' ').pop()) || artist.includes(who.split(' ').pop()) ? 1 : -1) : 0;
      return { a, score: Math.max(t, overlap) + 0.5 * art };
    })
    .filter((x) => x.score >= 0.7)
    .sort((x, y) => y.score - x.score);
  return scored;
}

/** オープンアクセス API に同じ作品があれば、その所蔵品を使う */
async function findInApis(ex) {
  const words = norm(ex.title).split(' ').filter((w) => w.length > 3).slice(0, 4);
  if (!words.length) return null;
  const lastName = norm(ex.artist).split(' ').pop();
  const m = { title: words.slice(0, 2), ...(lastName ? { artist: lastName } : {}) };
  for (const key of ['aic', 'cleveland', 'met']) {
    for await (const c of SOURCES[key].search(`${ex.title} ${ex.artist}`.trim(), 10)) {
      if (c.ok && matches(m, c)) return c;
    }
  }
  return null;
}

export async function processNotes(log) {
  const result = { processed: 0, linked: 0, created: 0, review: 0, errors: [] };
  if (!supabase) {
    log('SUPABASE_SERVICE_ROLE_KEY 未設定のため、記録の解説をスキップ');
    result.skipped = 'SUPABASE_SERVICE_ROLE_KEY 未設定';
    return result;
  }
  if (!hasClaude()) {
    result.skipped = 'ANTHROPIC_API_KEY 未設定';
    return result;
  }
  const { data: notes, error } = await supabase.from('notes').select('*').eq('status', 'pending').order('created_at').limit(MAX_NOTES);
  if (error) throw new Error('記録の取得に失敗: ' + error.message);
  if (!notes.length) return result;

  const artworks = readIf('data/artworks.json', []);
  const seedFile = 'pipeline/seeds/notes.json';
  const noteSeeds = readIf(seedFile, []);
  const { ids, keys } = existingKeys();

  for (const note of notes) {
    try {
      result.processed++;
      const images = [];
      for (const p of note.plate_photos.slice(0, 2)) images.push(imageB64(await download(p)));
      const workPhoto = note.photos[0] ? await download(note.photos[0]) : null;
      if (workPhoto) images.push(imageB64(workPhoto));
      const confirmed = note.ai_result?.confirmed;
      const hints = { 作品名メモ: note.title_memo, 作家メモ: note.artist_memo, 美術館: note.museum_name, 鑑賞日: note.visited_on, 本人が確定した候補: confirmed ?? null };
      if (!images.length && !note.title_memo && !confirmed) {
        await supabase.from('notes').update({ status: 'review', ai_result: { message: '写真もメモもないため特定できません。作品名メモを入力してください。', candidates: [] } }).eq('id', note.id);
        result.review++;
        continue;
      }
      const ex = await jsonCall({
        system: EXTRACT_SYSTEM,
        content: [...images, { type: 'text', text: `ユーザーのメモ：${JSON.stringify(hints)}\n画像（解説プレート、作品写真の順）から作品情報を読み取ってください。` }],
        schema: EXTRACT_SCHEMA,
        maxTokens: 4000,
      });
      if (confirmed?.title) {
        ex.title = ex.title || confirmed.title;
        ex.artist = ex.artist || confirmed.artist || '';
        ex.confidence = Math.max(ex.confidence, 0.9);
      }
      const extracted = { title: ex.title_ja || ex.title, artist: ex.artist, date: ex.date, technique: ex.technique, collection: ex.collection };

      // 1. 既存の作品 DB に一致
      const hit = findInDb(artworks, ex);
      if (hit.length && ex.confidence >= CONFIDENT && (hit.length === 1 || hit[0].score - hit[1].score >= 0.3)) {
        await supabase.from('notes').update({ artwork_id: hit[0].a.id, status: 'done', ai_result: { extracted, confidence: ex.confidence } }).eq('id', note.id);
        result.linked++;
        continue;
      }
      // 2. 確信度が低い → 要確認（候補最大3つ）
      if (ex.confidence < CONFIDENT) {
        const cands = [
          ...hit.slice(0, 2).map((h) => ({ title: h.a.title_ja || h.a.facts.title, artist: h.a.facts.artist, artwork_id: h.a.id, note: '図鑑の作品' })),
          ...(ex.title ? [{ title: ex.title_ja || ex.title, artist: ex.artist || null, note: 'プレートの読み取り結果' }] : []),
          ...ex.candidates.map((c) => ({ title: c.title, artist: c.artist || null, note: c.note || null })),
        ].slice(0, 3);
        await supabase.from('notes').update({ status: 'review', ai_result: { extracted, confidence: ex.confidence, candidates: cands, message: '読み取りに自信がありません。候補から選んでください。' } }).eq('id', note.id);
        result.review++;
        continue;
      }
      // 3. 新しい作品ページを作る（オープンアクセスにあればその画像・データ、なければプレートの読み取り）
      const api = await findInApis(ex);
      let seed;
      if (api && !keys.has(`${api.source}:${api.sourceId}`)) {
        const entry = await generateEntry(factsOf(api), api.record.image?.thumb ? { type: 'image', source: { type: 'url', url: api.record.image.thumb } } : undefined);
        seed = { id: uniqueId(slug(api.record.facts.artist, api.record.facts.title), ids), source: api.source, source_id: api.sourceId, auto_fallback: false, match: {}, genre: entry.genre, region: entry.region, style: entry.style, themes: entry.themes, ai: { title_ja: ex.title_ja || entry.title_ja, highlights: entry.highlights, story: entry.story, technique: entry.technique, trivia: entry.trivia }, from_note: true };
        keys.add(`${api.source}:${api.sourceId}`);
      } else if (api) {
        const existing = artworks.find((a) => `${a.source.key}:${a.source.id}` === `${api.source}:${api.sourceId}`);
        if (existing) {
          await supabase.from('notes').update({ artwork_id: existing.id, status: 'done', ai_result: { extracted, confidence: ex.confidence } }).eq('id', note.id);
          result.linked++;
          continue;
        }
      }
      if (!seed) {
        const facts = { title: ex.title, artist: ex.artist || null, date: ex.date || null, culture: ex.culture || null, medium: ex.technique || null, repository: ex.collection || note.museum_name || null };
        // 注釈の位置は「自分の写真」を基準に付ける
        const entry = await generateEntry(facts, workPhoto ? imageB64(workPhoto) : undefined);
        seed = {
          id: uniqueId(slug(ex.artist, ex.title), ids),
          source: 'plate',
          plate: { title: ex.title, artist: ex.artist || null, date: ex.date || null, technique: ex.technique || null, collection: ex.collection || note.museum_name || null, culture: ex.culture || null, year_start: ex.year_start || null, year_end: ex.year_end || null },
          genre: entry.genre, region: entry.region, style: entry.style, themes: entry.themes,
          ai: { title_ja: ex.title_ja || entry.title_ja, highlights: entry.highlights, story: entry.story, technique: entry.technique, trivia: entry.trivia },
          from_note: true,
        };
      }
      noteSeeds.push(seed);
      write(seedFile, noteSeeds);
      await supabase.from('notes').update({ artwork_id: seed.id, status: 'done', ai_result: { extracted, confidence: ex.confidence, created: today() } }).eq('id', note.id);
      result.created++;
    } catch (e) {
      result.errors.push(`${note.id}: ${e.message}`);
    }
  }
  return result;
}

// 単体実行用
if (import.meta.url === `file://${process.argv[1]}`) {
  processNotes(console.log).then((r) => console.log(r));
}
