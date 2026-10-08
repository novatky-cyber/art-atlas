import { createClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export type NoteStatus = 'pending' | 'review' | 'done';

export interface Candidate {
  title: string;
  artist?: string | null;
  artwork_id?: string | null;
  note?: string | null;
}

export interface Note {
  id: string;
  user_id?: string;
  artwork_id: string | null;
  status: NoteStatus;
  title_memo: string | null;
  artist_memo: string | null;
  museum_name: string | null;
  museum_ref: string | null;
  checkin_id: string | null;
  visited_on: string;
  comment: string | null;
  rating: number | null;
  moods: string[];
  photos: string[];
  plate_photos: string[];
  plate_text: string | null; // 端末 OCR で読み取ったプレートの文字（本人が確認・修正）
  ai_result: {
    extracted?: { title?: string; artist?: string; date?: string; technique?: string; collection?: string };
    confidence?: number;
    candidates?: Candidate[];
    confirmed?: Candidate;
    message?: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface Checkin {
  id: string;
  museum_name: string;
  museum_ref: string | null;
  lat: number | null;
  lng: number | null;
  started_at: string;
  ended_at: string | null;
}

export interface JobRun {
  id: number;
  kind: string;
  status: 'success' | 'partial' | 'failure';
  summary: string | null;
  created_at: string;
}
