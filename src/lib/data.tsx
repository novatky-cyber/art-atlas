import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Artwork, Period, Region, Style, Targets } from './types';

export interface Db {
  artworks: Artwork[];
  styles: Style[];
  regions: Region[];
  periods: Period[];
  targets: Targets;
  art: Record<string, Artwork>;
  style: Record<string, Style>;
  region: Record<string, Region>;
  period: Record<string, Period>;
  eras: Period[];
}

const DbContext = createContext<Db | null>(null);

const load = async <T,>(name: string): Promise<T> => {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`);
  if (!res.ok) throw new Error(`${name}.json の読み込みに失敗しました (${res.status})`);
  return res.json() as Promise<T>;
};
const index = <T extends { id: string }>(list: T[]) => Object.fromEntries(list.map((x) => [x.id, x]));

export function DataProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([
      load<Artwork[]>('artworks'),
      load<Style[]>('styles'),
      load<Region[]>('regions'),
      load<Period[]>('periods'),
      load<Targets>('targets'),
    ])
      .then(([artworks, styles, regions, periods, targets]) =>
        setDb({
          artworks,
          styles,
          regions,
          periods,
          targets,
          art: index(artworks),
          style: index(styles),
          region: index(regions),
          period: index(periods),
          eras: periods.filter((p) => p.scheme === 'world'),
        }),
      )
      .catch((e: Error) => setError(e.message));
  }, []);
  if (error) return <div className="empty">データを読み込めませんでした：{error}</div>;
  if (!db) return <div className="empty">読み込み中…</div>;
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb(): Db {
  const db = useContext(DbContext);
  if (!db) throw new Error('DataProvider がありません');
  return db;
}

export const fmtYear = (y: number | null | undefined) =>
  y == null ? '年代不明' : y < 0 ? `前${Math.abs(y)}年` : `${y}年`;

export const displayTitle = (a: Artwork) => a.title_ja || a.ai.title_ja || a.facts.title;
