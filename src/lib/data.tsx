import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Artist, Artwork, City, Museum, Period, Region, Style, Targets, Term, Theme } from './types';

export interface Db {
  artworks: Artwork[];
  styles: Style[];
  regions: Region[];
  periods: Period[];
  artists: Artist[];
  museums: Museum[];
  cities: City[];
  glossary: Term[];
  themes: Theme[];
  targets: Targets;
  art: Record<string, Artwork>;
  style: Record<string, Style>;
  region: Record<string, Region>;
  period: Record<string, Period>;
  artist: Record<string, Artist>;
  museum: Record<string, Museum>;
  city: Record<string, City>;
  term: Record<string, Term>;
  theme: Record<string, Theme>;
  eras: Period[];
  /** 作品 → 作家・美術館・都市（取得データの文字列から照合して導出） */
  artistOf: Record<string, string | undefined>;
  museumOf: Record<string, string | undefined>;
  placeOf: Record<string, string | undefined>; // 都市ID or 所在地名（建築）
}

const DbContext = createContext<Db | null>(null);

const load = async <T,>(name: string): Promise<T> => {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`);
  if (!res.ok) throw new Error(`${name}.json の読み込みに失敗しました (${res.status})`);
  return res.json() as Promise<T>;
};
const index = <T extends { id: string }>(list: T[]) => Object.fromEntries(list.map((x) => [x.id, x]));

export const norm = (s: string | null | undefined) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9぀-ヿ一-鿿]+/g, ' ')
    .trim();

function derive(artworks: Artwork[], artists: Artist[], museums: Museum[]) {
  const artistOf: Record<string, string | undefined> = {};
  const museumOf: Record<string, string | undefined> = {};
  const placeOf: Record<string, string | undefined> = {};
  for (const a of artworks) {
    const who = norm(a.facts.artist);
    artistOf[a.id] = who ? artists.find((x) => x.match.some((m) => who.includes(norm(m))))?.id : undefined;
    const where = norm([a.facts.repository, a.facts.credit_line].join(' '));
    const m = museums.find((x) => x.match.some((k) => where.includes(norm(k))));
    museumOf[a.id] = m?.id;
    // 美術館に該当しない建築・遺跡は、所在地の最初の要素を「場所」とする
    placeOf[a.id] = m ? m.city : a.facts.repository?.split('、')[0] || undefined;
  }
  return { artistOf, museumOf, placeOf };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([
      load<Artwork[]>('artworks'),
      load<Style[]>('styles'),
      load<Region[]>('regions'),
      load<Period[]>('periods'),
      load<Artist[]>('artists'),
      load<{ museums: Museum[]; cities: City[] }>('museums'),
      load<Term[]>('glossary'),
      load<Theme[]>('themes'),
      load<Targets>('targets'),
    ])
      .then(([artworks, styles, regions, periods, artists, mc, glossary, themes, targets]) =>
        setDb({
          artworks,
          styles,
          regions,
          periods,
          artists,
          museums: mc.museums,
          cities: mc.cities,
          glossary,
          themes,
          targets,
          art: index(artworks),
          style: index(styles),
          region: index(regions),
          period: index(periods),
          artist: index(artists),
          museum: index(mc.museums),
          city: index(mc.cities),
          term: index(glossary),
          theme: index(themes),
          eras: periods.filter((p) => p.scheme === 'world'),
          ...derive(artworks, artists, mc.museums),
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
export const fmtRange = (s: number, e: number) => `${s < 0 ? '前' + -s : s}〜${e < 0 ? '前' + -e : e}年`;

export const displayTitle = (a: Artwork) => a.title_ja || a.ai.title_ja || a.facts.title;

export function placeLabel(db: Db, place: string | undefined) {
  if (!place) return null;
  return db.city[place]?.name_ja ?? place;
}
