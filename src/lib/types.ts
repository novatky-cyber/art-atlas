export type Genre = 'painting' | 'sculpture' | 'architecture' | 'craft';

export interface Highlight {
  text: string;
  x: number; // 画像上の位置（%）
  y: number;
}

export interface Quote {
  text: string;
  source: string;
  url?: string;
}

export interface Artwork {
  id: string;
  batch: string;
  genre: Genre;
  region: string;
  region_group: string;
  style: string;
  themes: string[];
  period: string | null;
  era: string | null;
  year: number | null;
  year_start: number | null;
  year_end: number | null;
  year_estimated: boolean;
  title_ja: string | null;
  title_ja_source: 'wikidata' | 'ai';
  facts: {
    title: string;
    artist: string | null;
    artist_bio: string | null;
    date: string | null;
    culture: string | null;
    medium: string | null;
    dimensions: string | null;
    repository: string | null;
    credit_line: string | null;
    object_url: string | null;
  };
  image: { thumb: string; large: string; license: string; credit: string; source_url: string | null } | null;
  source: { name: string; id: string; api_url: string; key: string };
  ai: {
    title_ja: string;
    highlights: (Highlight | string)[];
    story?: string;
    technique?: string;
    trivia: string;
    quotes?: Quote[];
    ai_generated: true;
  };
  fetched_at: string;
}

export interface Style {
  id: string;
  name_ja: string;
  name_en: string;
  regions: string[];
  start: number;
  end: number;
  summary: string;
  features: string[];
  ai_generated: boolean;
}

export interface Region {
  id: string;
  name_ja: string;
  name_en: string;
  group: string;
  period_scheme: string;
  note: string;
}

export interface Period {
  id: string;
  scheme: string;
  name_ja: string;
  name_en: string;
  start: number;
  end: number;
  background: string | null;
}

export interface Artist {
  id: string;
  name_ja: string;
  name_en: string;
  match: string[];
  life: string;
  region: string;
  styles: string[];
  bio: string;
}

export interface Museum {
  id: string;
  name_ja: string;
  name_en: string;
  city: string;
  match: string[];
  url: string | null;
}

export interface City {
  id: string;
  name_ja: string;
  country_ja: string;
}

export interface Term {
  id: string;
  term: string;
  category: string;
  aliases: string[];
  desc: string;
}

export interface Theme {
  id: string;
  title: string;
  lead: string;
  points: string[];
  styles: string[];
}

export interface Targets {
  total: number;
  groups: Record<string, { label: string; target: number }>;
}

export const GENRE_LABEL: Record<Genre, string> = {
  painting: '絵画',
  sculpture: '彫刻',
  architecture: '建築',
  craft: '工芸',
};

export const hl = (h: Highlight | string): Highlight => (typeof h === 'string' ? { text: h, x: 50, y: 50 } : h);
