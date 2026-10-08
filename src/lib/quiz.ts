import type { Db } from './data';
import type { Artwork } from './types';
import type { Progress, QType, Question } from './storage';

/** 日付などから決まる疑似乱数（同じ日は同じ出題になる） */
export function rng(seedText: string) {
  let h = 2166136261;
  for (const c of seedText) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shuffle<T>(list: T[], rand: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pickDistractors = (correct: string, near: string[], far: string[], rand: () => number, nNear = 2) => {
  const n = shuffle(near.filter((x) => x !== correct), rand).slice(0, nNear);
  const f = shuffle(far.filter((x) => x !== correct && !n.includes(x)), rand);
  return [...n, ...f].slice(0, 3);
};

/** 選択肢は styles / periods / regions データから自動生成 */
export function makeQuestion(db: Db, a: Artwork, type: QType, rand: () => number): Question | null {
  let answer: string | null = null;
  let distractors: string[] = [];
  if (type === 'style') {
    answer = a.style;
    const st = db.style[a.style];
    if (!st) return null;
    const groups = new Set(st.regions.map((r) => db.region[r]?.group));
    const sameArea = db.styles.filter((s) => s.regions.some((r) => groups.has(db.region[r]?.group))).map((s) => s.id);
    // 近い時代の様式ほど紛らわしいので優先
    const mid = (st.start + st.end) / 2;
    const near = [...sameArea].sort((x, y) => {
      const sx = db.style[x], sy = db.style[y];
      return Math.abs((sx.start + sx.end) / 2 - mid) - Math.abs((sy.start + sy.end) / 2 - mid);
    }).slice(0, 8);
    distractors = pickDistractors(answer, near, [...sameArea, ...db.styles.map((s) => s.id)], rand);
  } else if (type === 'period') {
    answer = a.period;
    const p = answer ? db.period[answer] : null;
    if (!p) return null;
    const same = db.periods.filter((x) => x.scheme === p.scheme).map((x) => x.id);
    if (same.length < 4) return null;
    const idx = same.indexOf(p.id);
    const near = same.filter((_, i) => Math.abs(i - idx) <= 2);
    distractors = pickDistractors(p.id, near, same, rand);
  } else {
    answer = a.region;
    const r = db.region[a.region];
    const sameGroup = db.regions.filter((x) => x.group === r.group).map((x) => x.id);
    distractors = pickDistractors(answer, sameGroup, db.regions.map((x) => x.id), rand, 1);
  }
  if (!answer || distractors.length < 3) return null;
  return { id: a.id, type, answer, options: shuffle([answer, ...distractors], rand) };
}

export const TYPE_LABEL: Record<QType, string> = { style: '様式', period: '時代', region: '地域' };

export function optionLabel(db: Db, type: QType, id: string): string {
  if (type === 'style') return db.style[id]?.name_ja ?? id;
  if (type === 'period') return db.period[id]?.name_ja ?? id;
  return db.region[id]?.name_ja ?? id;
}

/** 今日の10問：期日が来た復習カード → 未学習カード → 期日前のカードの順で埋める */
export function buildDaily(db: Db, p: Progress, date: string, round = 0, size = 10): Question[] {
  const rand = rng(`${date}:${round}`);
  const due = db.artworks
    .filter((a) => p.cards[a.id] && p.cards[a.id].due <= date)
    .sort((x, y) => p.cards[x.id].due.localeCompare(p.cards[y.id].due));
  const fresh = shuffle(db.artworks.filter((a) => !p.cards[a.id]), rand);
  const later = db.artworks
    .filter((a) => p.cards[a.id] && p.cards[a.id].due > date)
    .sort((x, y) => p.cards[x.id].due.localeCompare(p.cards[y.id].due));
  const pool = [...due, ...fresh, ...later];
  const types: QType[] = ['style', 'period', 'region'];
  const out: Question[] = [];
  for (const a of pool) {
    if (out.length >= size) break;
    for (const t of shuffle(types, rand)) {
      const q = makeQuestion(db, a, t, rand);
      if (q) {
        out.push(q);
        break;
      }
    }
  }
  return out;
}
