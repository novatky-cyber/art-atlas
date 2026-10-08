// 地域グループ別の進捗（シード数・取得済み数・目標）と、次の100点の推奨配分を表示
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const targets = read('config/targets.json');
const regions = Object.fromEntries(read('data/regions.json').map((r) => [r.id, r]));
const seeds = readdirSync(new URL('pipeline/seeds/', root)).filter((f) => /^batch-\d+\.json$/.test(f)).sort()
  .flatMap((f) => read(`pipeline/seeds/${f}`));
const arts = existsSync(new URL('data/artworks.json', root)) ? read('data/artworks.json') : [];
const N = Number(process.argv[2] ?? 100);

const count = (list, key) => list.reduce((m, x) => ((m[key(x)] = (m[key(x)] ?? 0) + 1), m), {});
const sc = count(seeds, (s) => regions[s.region].group);
const ac = count(arts, (a) => a.region_group);
const genre = count(arts, (a) => a.genre);

const total = Object.values(targets.groups).reduce((s, g) => s + g.target, 0);
const done = seeds.length;
const nextTotal = done + N;
const rows = Object.entries(targets.groups).map(([k, g]) => {
  const ideal = (g.target / total) * nextTotal;
  return { k, label: g.label, target: g.target, seeds: sc[k] ?? 0, fetched: ac[k] ?? 0, need: Math.max(0, ideal - (sc[k] ?? 0)) };
});
const needSum = rows.reduce((s, r) => s + r.need, 0) || 1;
let alloc = rows.map((r) => ({ ...r, next: Math.floor((r.need / needSum) * N) }));
let rest = N - alloc.reduce((s, r) => s + r.next, 0);
for (const r of [...alloc].sort((a, b) => b.need - a.need)) { if (rest-- <= 0) break; r.next++; }

console.log(`シード ${seeds.length} 点 / 取得済み ${arts.length} 点 / 目標 ${total} 点`);
console.table(alloc.map((r) => ({ 地域: r.label, 目標: r.target, シード: r.seeds, 取得済: r.fetched, [`次の${N}点`]: r.next })));
console.log('ジャンル内訳（取得済み）:', genre);
