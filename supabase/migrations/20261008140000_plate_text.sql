-- 解説プレートを端末で OCR した文字（本人が確認・修正したもの）。夜間ルーティンはこの文字から作品を特定する。
alter table public.notes add column if not exists plate_text text;
