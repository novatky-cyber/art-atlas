#!/usr/bin/env node
// 夜間ルーティン用：作品名・作家から、既存の作品 DB（data/artworks.json）の候補を探す。
//   node pipeline/nightly/find-artwork.mjs "作品名（原題か和題）" "作家名"
import { readIf } from './common.mjs';
import { norm } from '../lib/match.mjs';

export function findInDb(artworks, title, artist) {
  const titles = [title].map(norm).filter((t) => t.length >= 2);
  const who = norm(artist);
  return artworks
    .map((a) => {
      const names = [a.facts.title, a.title_ja, a.ai?.title_ja].map(norm);
      const exact = titles.some((x) => names.some((n) => n && (n.includes(x) || x.includes(n)))) ? 1 : 0;
      const tokens = new Set(titles.join(' ').split(' ').filter((w) => w.length > 2));
      const overlap = tokens.size ? [...tokens].filter((w) => names.join(' ').includes(w)).length / tokens.size : 0;
      const aw = norm(a.facts.artist);
      const last = (s) => s.split(' ').filter(Boolean).pop() ?? '';
      const art = who && aw ? (aw.includes(last(who)) || who.includes(last(aw)) ? 1 : -1) : 0;
      return { id: a.id, title: a.title_ja || a.facts.title, artist: a.facts.artist, repository: a.facts.repository, score: +(Math.max(exact, overlap) + 0.5 * art).toFixed(2) };
    })
    .filter((x) => x.score >= 0.5)
    .sort((x, y) => y.score - x.score)
    .slice(0, 5);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [title = '', artist = ''] = process.argv.slice(2);
  console.log(JSON.stringify(findInDb(readIf('data/artworks.json', []), title, artist), null, 1));
}
