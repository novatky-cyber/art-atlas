import { useCallback, useEffect, useState } from 'react';

// 学習進捗は localStorage に保存（失敗しても動作継続）。JSON でエクスポート/インポート可能。
export const STORAGE_KEY = 'art-atlas:progress:v1';
export const INTERVALS = [1, 3, 7, 21] as const; // Leitner: box0=翌日, box1=3日, box2=7日, box3=21日

export type QType = 'style' | 'period' | 'region';

export interface CardState {
  box: number; // 0..3
  due: string; // YYYY-MM-DD
  correct: number;
  wrong: number;
  last: string;
}

export interface Question {
  id: string;
  type: QType;
  options: string[]; // 選択肢の ID（style/period/region）
  answer: string;
}

export interface Progress {
  v: 1;
  cards: Record<string, CardState>;
  collected: Record<string, string>; // 作品ID -> 初めて正解した日
  daily: { date: string; round: number; questions: Question[]; answers: (string | null)[]; reveal?: boolean } | null;
  history: Record<string, { correct: number; total: number }>;
}

export const emptyProgress = (): Progress => ({ v: 1, cards: {}, collected: {}, daily: null, history: {} });

export function today(d = new Date()): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return today(d);
}

function readStore(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    return sanitize(JSON.parse(raw));
  } catch {
    return emptyProgress();
  }
}
function writeStore(p: Progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* プライベートモード等では保存できないが、表示は続ける */
  }
}

export function sanitize(x: unknown): Progress {
  const p = x as Partial<Progress> | null;
  if (!p || typeof p !== 'object' || p.v !== 1) throw new Error('形式が正しくありません（v:1 の進捗データではありません）');
  return {
    v: 1,
    cards: p.cards && typeof p.cards === 'object' ? p.cards : {},
    collected: p.collected && typeof p.collected === 'object' ? p.collected : {},
    daily: p.daily ?? null,
    history: p.history && typeof p.history === 'object' ? p.history : {},
  };
}

/** Leitner 方式：誤答→翌日、正答→3日→7日→21日（以降21日） */
export function review(prev: CardState | undefined, correct: boolean, date: string): CardState {
  const box = correct ? (prev ? Math.min(prev.box + 1, INTERVALS.length - 1) : 1) : 0;
  return {
    box,
    due: addDays(date, INTERVALS[box]),
    correct: (prev?.correct ?? 0) + (correct ? 1 : 0),
    wrong: (prev?.wrong ?? 0) + (correct ? 0 : 1),
    last: date,
  };
}

const listeners = new Set<(p: Progress) => void>();
let current: Progress | null = null;

export function useProgress() {
  const [p, setP] = useState<Progress>(() => (current ??= readStore()));
  useEffect(() => {
    listeners.add(setP);
    return () => {
      listeners.delete(setP);
    };
  }, []);
  const update = useCallback((fn: (p: Progress) => Progress) => {
    current = fn(current ?? readStore());
    writeStore(current);
    listeners.forEach((l) => l(current!));
  }, []);
  return [p, update] as const;
}

export function exportProgress(p: Progress) {
  const blob = new Blob([JSON.stringify({ app: 'art-atlas', exported_at: new Date().toISOString(), ...p }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `art-atlas-progress-${today()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
