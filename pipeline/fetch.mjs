#!/usr/bin/env node
// シード（pipeline/seeds/*.json）を各 API で解決し、data/artworks.json を生成する。
//
//   node pipeline/fetch.mjs              未取得のシードだけ取得（取得済みは保持し、AI解説・分類のみ更新）
//   node pipeline/fetch.mjs --refresh    全シードを再取得
//   node pipeline/fetch.mjs --only=id1,id2
//   node pipeline/fetch.mjs --batch=batch-002
//
// 事実（作品名・作家・年代・所蔵）と画像 URL・ライセンスは取得データのみを使う。
// 見どころ・豆知識はシードの ai ブロック（ai_generated: true）から付与する。
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { SOURCES, MUSEUMS } from './lib/sources.mjs';
import { matches } from './lib/match.mjs';
import { stats } from './lib/http.mjs';
import { assignPeriod } from './lib/periods.mjs';

const root = new URL('../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));

const regions = read('data/regions.json');
const periods = read('data/periods.json');
const regionById = Object.fromEntries(regions.map((r) => [r.id, r]));
const styleById = Object.fromEntries(read('data/styles.json').map((s) => [s.id, s]));

const seedFiles = readdirSync(new URL('pipeline/seeds/', root)).filter((f) => /^batch-\d+\.json$/.test(f)).sort();
const seeds = seedFiles.flatMap((f) => read(`pipeline/seeds/${f}`).map((s) => ({ ...s, batch: f.replace('.json', '') })));
const existing = existsSync(new URL('data/artworks.json', root)) ? read('data/artworks.json') : [];
const prev = Object.fromEntries(existing.map((a) => [a.id, a]));

const only = args.only ? new Set(String(args.only).split(',')) : null;
const wants = (s) => (only ? only.has(s.id) : args.batch ? s.batch === args.batch : true);

/** シードに対して試す（source, query, match）の順序付きリスト */
function plans(seed) {
  const base = [{ source: seed.source, id: seed.source_id, queries: seed.queries ?? [seed.query], match: seed.match }];
  for (const f of seed.fallbacks ?? []) base.push({ source: f.source, id: f.source_id, queries: f.queries ?? [f.query ?? seed.query], match: f.match ?? seed.match });
  // 美術館シードは他の美術館でも同条件で探す（題名・作家・年代が一致したもののみ採用）
  if (MUSEUMS.includes(seed.source) && seed.auto_fallback !== false) {
    for (const s of [...MUSEUMS, 'smithsonian']) {
      if (!base.some((b) => b.source === s)) base.push({ source: s, queries: seed.queries ?? [seed.query], match: seed.match });
    }
  }
  return base;
}

async function accept(c, match) {
  if (!c || !c.ok || !matches(match, c)) return false;
  if (c.build) return c.build();
  return true;
}

async function resolve(seed) {
  for (const p of plans(seed)) {
    const src = SOURCES[p.source];
    if (!src) continue;
    if (p.id) {
      const c = await src.byId(p.id);
      if (await accept(c, p.match)) return c;
    }
    for (const q of p.queries.filter(Boolean)) {
      for await (const c of src.search(q)) {
        if (await accept(c, p.match)) return c;
      }
    }
  }
  return null;
}

function compose(seed, fetched) {
  const region = regionById[seed.region];
  const ys = fetched.yearStart ?? fetched.yearEnd;
  const ye = fetched.yearEnd ?? fetched.yearStart;
  let year = ys != null ? Math.round((ys + ye) / 2) : null;
  let { period, era, estimatedYear } = assignPeriod(periods, region.period_scheme, year, seed.period);
  if (year == null && estimatedYear == null) {
    // 取得データに年がない場合は様式の年代幅の中央を推定値とする（year_estimated で明示）
    const st = styleById[seed.style];
    estimatedYear = Math.round((Math.max(st.start, -3000) + st.end) / 2);
    ({ period, era } = assignPeriod(periods, region.period_scheme, estimatedYear, seed.period));
  }
  const yearEstimated = year == null && estimatedYear != null;
  if (year == null) year = estimatedYear;
  const r = fetched.record;
  return {
    id: seed.id,
    batch: seed.batch,
    genre: seed.genre,
    region: seed.region,
    region_group: region.group,
    style: seed.style,
    period,
    era,
    year,
    year_start: ys,
    year_end: ye,
    year_estimated: yearEstimated,
    title_ja: r.title_ja_fact || seed.ai?.title_ja || null,
    title_ja_source: r.title_ja_fact ? 'wikidata' : 'ai',
    facts: r.facts,
    image: r.image,
    source: { ...r.source, key: fetched.source },
    ai: { ...seed.ai, ai_generated: true },
    fetched_at: new Date().toISOString().slice(0, 10),
  };
}

/** 取得済みデータに最新のシード（分類・AI解説）を反映 */
function refreshCurated(seed, a) {
  const region = regionById[seed.region];
  const { period, era } = assignPeriod(periods, region.period_scheme, a.year_estimated ? null : a.year, seed.period);
  return {
    ...a,
    batch: seed.batch,
    genre: seed.genre,
    region: seed.region,
    region_group: region.group,
    style: seed.style,
    period,
    era,
    title_ja: a.title_ja_source === 'wikidata' ? a.title_ja : seed.ai?.title_ja || a.title_ja,
    ai: { ...seed.ai, ai_generated: true },
  };
}

const out = [];
const unresolved = [];
let fetchedCount = 0;
for (const seed of seeds) {
  const old = prev[seed.id];
  const force = (args.refresh && wants(seed)) || only?.has(seed.id);
  if (old && !force) { out.push(refreshCurated(seed, old)); continue; }
  if (!old && !wants(seed)) continue;
  process.stdout.write(`- ${seed.id} … `);
  const c = await resolve(seed);
  if (c) {
    out.push(compose(seed, c));
    fetchedCount++;
    console.log(`OK ${c.source}:${c.sourceId} 「${c.record.facts.title}」`);
  } else if (old) {
    out.push(refreshCurated(seed, old));
    console.log('再取得失敗（前回データを保持）');
  } else {
    unresolved.push({ id: seed.id, batch: seed.batch, source: seed.source, query: seed.query ?? seed.queries?.[0] });
    console.log('未解決');
  }
}

// 重複（同じ所蔵品が別シードに解決された）を検出
const seen = new Map();
const dups = [];
for (const a of out) {
  const k = `${a.source.key}:${a.source.id}`;
  if (seen.has(k)) dups.push([seen.get(k), a.id]);
  else seen.set(k, a.id);
}

if (!args.dry) {
  writeFileSync(new URL('data/artworks.json', root), JSON.stringify(out, null, 1) + '\n');
  writeFileSync(new URL('data/fetch-report.json', root), JSON.stringify({
    generated_at: new Date().toISOString(),
    seeds: seeds.length,
    artworks: out.length,
    newly_fetched: fetchedCount,
    unresolved,
    duplicates: dups,
    by_source: out.reduce((m, a) => ({ ...m, [a.source.key]: (m[a.source.key] ?? 0) + 1 }), {}),
    http: stats,
  }, null, 2) + '\n');
}
console.log(`\n作品 ${out.length} 点（今回取得 ${fetchedCount}）／未解決 ${unresolved.length}／重複 ${dups.length}／HTTP ${stats.requests} 回`);
if (unresolved.length) console.log('未解決: ' + unresolved.map((u) => u.id).join(', '));
if (dups.length) console.log('重複: ' + dups.map((d) => d.join('=')).join(', '));
