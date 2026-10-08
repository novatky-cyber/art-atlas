// data/ と pipeline/seeds/ の整合性チェック（CI・ビルド前に実行）
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const errors = [];
const warns = [];
const err = (m) => errors.push(m);

const regions = read('data/regions.json');
const periods = read('data/periods.json');
const styles = read('data/styles.json');
const targets = read('config/targets.json');
const GENRES = ['painting', 'sculpture', 'architecture', 'craft'];

const regionIds = new Set(regions.map((r) => r.id));
const periodIds = new Set(periods.map((p) => p.id));
const styleIds = new Set(styles.map((s) => s.id));
const schemes = new Set(periods.map((p) => p.scheme));

for (const [name, list] of [['regions', regions], ['periods', periods], ['styles', styles]]) {
  const seen = new Set();
  for (const x of list) {
    if (!x.id || seen.has(x.id)) err(`${name}: id 重複/欠落 ${x.id}`);
    seen.add(x.id);
    if (!x.name_ja) err(`${name}: ${x.id} name_ja なし`);
  }
}
for (const r of regions) {
  if (!targets.groups[r.group]) err(`regions: ${r.id} の group ${r.group} が config/targets.json にない`);
  if (!schemes.has(r.period_scheme)) err(`regions: ${r.id} の period_scheme ${r.period_scheme} が periods にない`);
}
for (const s of styles) {
  for (const r of s.regions) if (!regionIds.has(r)) err(`styles: ${s.id} の region ${r} が不正`);
  if (!Array.isArray(s.features) || s.features.length < 2) err(`styles: ${s.id} features 不足`);
  if (s.ai_generated !== true) err(`styles: ${s.id} ai_generated: true が必要`);
}

const seedFiles = readdirSync(new URL('pipeline/seeds/', root)).filter((f) => /^batch-\d+\.json$/.test(f));
const seedIds = new Set();
for (const f of seedFiles) {
  for (const s of read(`pipeline/seeds/${f}`)) {
    const at = `${f}:${s.id}`;
    if (!s.id || !/^[a-z0-9-]+$/.test(s.id)) err(`${at} id は英小文字・数字・ハイフンのみ`);
    if (seedIds.has(s.id)) err(`${at} id 重複`);
    seedIds.add(s.id);
    if (!['met', 'aic', 'cleveland', 'smithsonian', 'wikidata'].includes(s.source)) err(`${at} source 不正 ${s.source}`);
    if (!s.query && !s.queries?.length && !s.source_id) err(`${at} query/source_id なし`);
    if (!GENRES.includes(s.genre)) err(`${at} genre 不正 ${s.genre}`);
    if (!regionIds.has(s.region)) err(`${at} region 不正 ${s.region}`);
    if (!styleIds.has(s.style)) err(`${at} style 不正 ${s.style}`);
    if (s.period && !periodIds.has(s.period)) err(`${at} period 不正 ${s.period}`);
    if (!s.match || !Object.keys(s.match).length) warns.push(`${at} match 条件なし（誤取得の恐れ）`);
    const ai = s.ai ?? {};
    if (!ai.title_ja) err(`${at} ai.title_ja なし`);
    if (!Array.isArray(ai.highlights) || ai.highlights.length !== 3) err(`${at} ai.highlights は3点必要`);
    if (!ai.trivia) err(`${at} ai.trivia なし`);
    const st = styles.find((x) => x.id === s.style);
    if (st && !st.regions.includes(s.region)) warns.push(`${at} style ${s.style} の想定地域に ${s.region} がない`);
  }
}

if (existsSync(new URL('data/artworks.json', root))) {
  const arts = read('data/artworks.json');
  for (const a of arts) {
    if (!seedIds.has(a.id)) warns.push(`artworks: ${a.id} に対応するシードがない`);
    if (!a.image?.thumb) err(`artworks: ${a.id} 画像なし`);
    if (!a.image?.license) err(`artworks: ${a.id} ライセンスなし`);
    if (!a.facts?.title) err(`artworks: ${a.id} 作品名なし`);
    if (a.ai?.ai_generated !== true) err(`artworks: ${a.id} ai_generated フラグなし`);
  }
}

for (const w of warns) console.warn('warn: ' + w);
if (errors.length) {
  for (const e of errors) console.error('error: ' + e);
  process.exit(1);
}
console.log(`validate OK (regions ${regions.length}, periods ${periods.length}, styles ${styles.length}, seeds ${seedIds.size})`);
