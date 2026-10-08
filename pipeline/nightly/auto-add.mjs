// 毎晩の作品自動追加：config/targets.json の不足地域（日本以外を優先）に合わせて、
// 美術館の代表作（AIC is_boosted / Cleveland highlight、いずれもパブリックドメイン）から選び、Claude で分類・解説を作る。
import { hasClaude, mapLimit } from './claude.mjs';
import { generateEntry } from './entry.mjs';
import { existingKeys, read, readIf, slug, today, uniqueId, write, factsOf } from './common.mjs';
import { aic, cleveland } from '../lib/sources.mjs';

const COUNT = Number(process.env.NIGHTLY_COUNT || 50);
const SPARE = 1.25; // 不適切判定・失敗に備えて多めに生成

/** 取得データの文字列から地域グループを大まかに推定（最終的な地域は Claude が決める） */
export function guessGroup(c) {
  const t = c.all.toLowerCase();
  const y = c.yearStart ?? 1500;
  if (/japan|japanese/.test(t)) return 'japan';
  if (/china|chinese/.test(t)) return 'china';
  if (/korea/.test(t)) return 'other';
  if (/india|pakistan|nepal|tibet|sri lanka|cambodia|thailand|indonesia|java|vietnam|myanmar|burma|laos/.test(t)) return 'south-southeast-asia';
  if (y < 500 && /egypt|greek|greece|roman|rome|etruscan|cyprus|mesopotamia|assyria|babylon|sumer|persia|iran|anatolia|cycladic|minoan/.test(t)) return 'ancient';
  if (/islamic|iran|persia|turkey|ottoman|syria|iraq|egypt|mamluk|safavid|timurid|mughal|morocco|spain, (andalus|granada)/.test(t)) return 'islamic';
  if (/africa|nigeria|benin|congo|mali|ghana|ivory coast|cameroon|oceania|polynesia|new guinea|maya|aztec|inca|peru|mexico|olmec|andean|mesoamerica/.test(t)) return 'other';
  return 'western';
}

/** 不足に応じた今夜の配分（日本は他地域が埋まるまで後回し） */
export function allocate(count) {
  const targets = read('config/targets.json').groups;
  const arts = readIf('data/artworks.json', []);
  const have = arts.reduce((m, a) => ((m[a.region_group] = (m[a.region_group] ?? 0) + 1), m), {});
  const need = Object.fromEntries(Object.entries(targets).map(([k, g]) => [k, Math.max(0, g.target - (have[k] ?? 0))]));
  const overseas = Object.keys(need).filter((k) => k !== 'japan' && need[k] > 0);
  const order = overseas.length ? overseas : Object.keys(need).filter((k) => need[k] > 0);
  const total = order.reduce((s, k) => s + need[k], 0) || 1;
  const alloc = Object.fromEntries(order.map((k) => [k, Math.floor((need[k] / total) * count)]));
  let rest = count - Object.values(alloc).reduce((s, n) => s + n, 0);
  for (const k of [...order].sort((a, b) => need[b] - need[a])) {
    if (rest-- <= 0) break;
    alloc[k]++;
  }
  return alloc;
}

async function gatherPool(keys) {
  const pool = [];
  const rand = (n) => Math.floor(Math.random() * n);
  // 毎晩ランダムな位置から数ページ取得し、偏りを減らす
  for (const off of [rand(1500), rand(1500), rand(1500)]) pool.push(...(await aic.pool(off, 100)));
  for (const off of [rand(2000), rand(2000), rand(2000)]) pool.push(...(await cleveland.pool(off, 100)));
  const seen = new Set();
  return pool.filter((c) => {
    const k = `${c.source}:${c.sourceId}`;
    if (!c.ok || keys.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function autoAdd(log) {
  const result = { requested: COUNT, added: 0, skipped: 0, errors: [], allocation: {} };
  if (!hasClaude()) {
    result.skipped_reason = 'ANTHROPIC_API_KEY 未設定';
    return result;
  }
  const alloc = allocate(COUNT);
  result.allocation = alloc;
  const { ids, keys } = existingKeys();
  const pool = await gatherPool(keys);
  log(`候補 ${pool.length} 点を取得、配分 ${JSON.stringify(alloc)}`);

  const byGroup = {};
  for (const c of pool) (byGroup[guessGroup(c)] ??= []).push(c);
  const picked = [];
  for (const [g, n] of Object.entries(alloc)) picked.push(...(byGroup[g] ?? []).sort(() => Math.random() - 0.5).slice(0, Math.ceil(n * SPARE)));
  // 不足地域で候補が足りない分は西洋以外から補う
  const fill = Object.entries(byGroup).filter(([g]) => g !== 'japan').flatMap(([, l]) => l).filter((c) => !picked.includes(c));
  while (picked.length < Math.ceil(COUNT * SPARE) && fill.length) picked.push(fill.splice(Math.floor(Math.random() * fill.length), 1)[0]);

  const entries = await mapLimit(picked, 4, async (c) => {
    const e = await generateEntry(factsOf(c), c.record.image?.thumb ? { type: 'image', source: { type: 'url', url: c.record.image.thumb } } : undefined);
    return { c, e };
  });

  const seeds = [];
  for (const r of entries) {
    if (seeds.length >= COUNT) break;
    if (r?.error) {
      result.errors.push(r.error.message);
      continue;
    }
    const { c, e } = r;
    if (!e.suitable) {
      result.skipped++;
      continue;
    }
    seeds.push({
      id: uniqueId(slug(c.record.facts.artist?.split(/[\n(]/)[0], c.record.facts.title), ids),
      source: c.source,
      source_id: c.sourceId,
      auto_fallback: false,
      match: {},
      genre: e.genre,
      region: e.region,
      style: e.style,
      themes: e.themes,
      ai: { title_ja: e.title_ja, highlights: e.highlights, story: e.story, technique: e.technique, trivia: e.trivia },
    });
  }
  if (seeds.length) {
    const file = `pipeline/seeds/auto-${today()}.json`;
    write(file, [...readIf(file, []), ...seeds]);
    result.file = file;
  }
  result.added = seeds.length;
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  autoAdd(console.log).then((r) => console.log(r));
}
