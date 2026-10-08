// シード記述（match 条件）と取得メタデータの照合
export const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9぀-ヿ一-鿿]+/g, ' ')
    .trim();

/**
 * @param {{title?:string[], title_any?:string[], artist?:string, any?:string[], year?:[number,number]}} m
 * @param {{title:string, artist:string, all:string, yearStart:number|null, yearEnd:number|null}} c
 */
export function matches(m = {}, c) {
  const t = ` ${norm(c.title)} `;
  for (const w of m.title ?? []) if (!t.includes(norm(w))) return false;
  if (m.title_any && !m.title_any.some((w) => t.includes(norm(w)))) return false;
  if (m.artist && !norm(c.artist).includes(norm(m.artist))) return false;
  const all = norm(c.all);
  for (const w of m.any ?? []) if (!all.includes(norm(w))) return false;
  if (m.year) {
    const [lo, hi] = m.year;
    const s = c.yearStart ?? c.yearEnd;
    const e = c.yearEnd ?? c.yearStart;
    if (s == null) return false;
    if (e < lo || s > hi) return false;
  }
  return true;
}
