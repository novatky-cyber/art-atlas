#!/usr/bin/env node
// 夜間ルーティン用の「作品候補リスト」を作る（GitHub Actions で実行。Claude API は使わない）。
// config/targets.json の不足地域（日本以外を優先）に合わせて、美術館の代表作
// （AIC is_boosted / Cleveland highlight、いずれもパブリックドメイン）から候補を集め、
// pipeline/candidates/next.json に取得データ（事実）と画像 URL を書き出す。
// 解説文はこの後、Claude Code の夜間ルーティンが書く（docs/nightly-routine.md）。
import { aic, cleveland } from '../lib/sources.mjs';
import { existingKeys, read, readIf, today, write } from './common.mjs';

const COUNT = Number(process.env.NIGHTLY_COUNT || 20);
const SPARE = 1.5; // 不適切な候補を除外できるよう多めに

/** 取得データの文字列から地域グループを大まかに推定（最終的な地域はルーティンが決める） */
export function guessGroup(c) {
  const t = c.all.toLowerCase();
  const y = c.yearStart ?? 1500;
  if (/japan|japanese/.test(t)) return 'japan';
  if (/china|chinese/.test(t)) return 'china';
  if (/korea/.test(t)) return 'other';
  if (/india|pakistan|nepal|tibet|sri lanka|cambodia|thailand|indonesia|java|vietnam|myanmar|burma|laos/.test(t)) return 'south-southeast-asia';
  if (y < 500 && /egypt|greek|greece|roman|rome|etruscan|cyprus|mesopotamia|assyria|babylon|sumer|persia|iran|anatolia|cycladic|minoan/.test(t)) return 'ancient';
  if (/islamic|iran|persia|turkey|ottoman|syria|iraq|egypt|mamluk|safavid|timurid|mughal|morocco/.test(t)) return 'islamic';
  if (/africa|nigeria|benin|congo|mali|ghana|ivory coast|cameroon|oceania|polynesia|new guinea|maya|aztec|inca|peru|mexico|olmec|andean|mesoamerica/.test(t)) return 'other';
  return 'western';
}

/** 不足に応じた配分（日本は他地域が埋まるまで後回し） */
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
  for (const off of [rand(1500), rand(1500), rand(1500), rand(1500)]) pool.push(...(await aic.pool(off, 100)));
  for (const off of [rand(2000), rand(2000), rand(2000), rand(2000)]) pool.push(...(await cleveland.pool(off, 100)));
  const seen = new Set();
  return pool.filter((c) => {
    const k = `${c.source}:${c.sourceId}`;
    if (!c.ok || keys.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const alloc = allocate(COUNT);
const { keys } = existingKeys();
const pool = await gatherPool(keys);
const byGroup = {};
for (const c of pool) (byGroup[guessGroup(c)] ??= []).push(c);
const picked = [];
for (const [g, n] of Object.entries(alloc)) picked.push(...(byGroup[g] ?? []).sort(() => Math.random() - 0.5).slice(0, Math.ceil(n * SPARE)).map((c) => ({ c, g })));
// 不足地域の候補が足りない分は、日本以外の残りから補う
const rest = Object.entries(byGroup).filter(([g]) => g !== 'japan').flatMap(([g, l]) => l.map((c) => ({ c, g }))).filter((x) => !picked.some((p) => p.c === x.c));
while (picked.length < Math.ceil(COUNT * SPARE) && rest.length) picked.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);

const out = {
  generated_at: new Date().toISOString(),
  date: today(),
  count: COUNT,
  allocation: alloc,
  candidates: picked.map(({ c, g }) => ({
    source: c.source,
    source_id: c.sourceId,
    guess_group: g,
    facts: c.record.facts,
    year_start: c.yearStart,
    year_end: c.yearEnd,
    image: c.record.image?.thumb ?? null,
  })),
};
write('pipeline/candidates/next.json', out);
console.log(`候補 ${out.candidates.length} 点（プール ${pool.length}）配分 ${JSON.stringify(alloc)}`);
