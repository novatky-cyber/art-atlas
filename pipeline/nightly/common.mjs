import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { norm } from '../lib/match.mjs';

export const root = new URL('../../', import.meta.url);
export const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
export const readIf = (p, d) => (existsSync(new URL(p, root)) ? read(p) : d);
export const write = (p, v) => writeFileSync(new URL(p, root), JSON.stringify(v, null, 1) + '\n');

export const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); // 日本時間の日付

export function slug(...parts) {
  const s = norm(parts.filter(Boolean).join(' ')).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  return s || 'work';
}

/** 全シードの id 集合と、取得済み/シード済みの所蔵品キー（source:id） */
export function existingKeys() {
  const ids = new Set();
  const keys = new Set();
  for (const f of readdirSync(new URL('pipeline/seeds/', root)).filter((x) => x.endsWith('.json'))) {
    for (const s of read(`pipeline/seeds/${f}`)) {
      ids.add(s.id);
      if (s.source_id) keys.add(`${s.source}:${s.source_id}`);
    }
  }
  for (const a of readIf('data/artworks.json', [])) {
    ids.add(a.id);
    keys.add(`${a.source.key}:${a.source.id}`);
  }
  return { ids, keys };
}

export function uniqueId(base, ids) {
  let id = base;
  for (let i = 2; ids.has(id); i++) id = `${base}-${i}`;
  ids.add(id);
  return id;
}

