// Supabase の URL と公開（publishable）キー。ブラウザに置く前提のキーで、
// データの読み書きは Supabase 側の RLS により「持ち主本人」に限定される。
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mcpibsyhekyboohsgrbr.supabase.co';
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_SjitUvAmGWm0rDsx0FRVYA_GS9SrtGF';
export const PHOTO_BUCKET = 'photos';
export const MOODS = ['色が好き', '圧倒された', '不思議', '心が落ち着く', 'また見たい', 'もっと知りたい'] as const;
