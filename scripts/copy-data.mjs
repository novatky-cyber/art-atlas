// data/*.json と config/targets.json を public/data/ にコピー（アプリは実行時に fetch する）
import { mkdirSync, copyFileSync, existsSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const out = new URL('public/data/', root);
mkdirSync(out, { recursive: true });
for (const f of ['artworks', 'styles', 'regions', 'periods']) {
  const src = new URL(`data/${f}.json`, root);
  if (existsSync(src)) copyFileSync(src, new URL(`${f}.json`, out));
  else writeFileSync(new URL(`${f}.json`, out), '[]\n');
}
copyFileSync(new URL('config/targets.json', root), new URL('targets.json', out));
