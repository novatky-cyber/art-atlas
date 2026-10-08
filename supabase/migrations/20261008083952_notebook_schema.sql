-- 美術手帳：1人用。最初にログインしたユーザーを「持ち主」として登録し、以後は持ち主だけが読み書きできる。
create table public.app_owner (
  singleton boolean primary key default true check (singleton),
  owner_id uuid not null references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now()
);
alter table public.app_owner enable row level security;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_owner where owner_id = auth.uid());
$$;

create or replace function public.claim_owner() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  insert into public.app_owner(owner_id) values (auth.uid()) on conflict do nothing;
  return exists (select 1 from public.app_owner where owner_id = auth.uid());
end $$;
revoke all on function public.claim_owner() from public, anon;
grant execute on function public.claim_owner() to authenticated;
grant execute on function public.is_owner() to authenticated;

create policy "owner reads owner row" on public.app_owner for select to authenticated using (owner_id = auth.uid());

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  museum_name text not null,
  museum_ref text,
  lat double precision,
  lng double precision,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  artwork_id text,
  status text not null default 'done' check (status in ('pending','review','done')),
  title_memo text,
  artist_memo text,
  museum_name text,
  museum_ref text,
  checkin_id uuid references public.checkins(id) on delete set null,
  visited_on date not null default current_date,
  comment text,
  rating smallint check (rating between 1 and 5),
  moods text[] not null default '{}',
  photos text[] not null default '{}',
  plate_photos text[] not null default '{}',
  ai_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_user_visited on public.notes(user_id, visited_on desc);
create index notes_status on public.notes(status);

create table public.pin_positions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  artwork_id text not null,
  positions jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, artwork_id)
);

create table public.job_runs (
  id bigint generated always as identity primary key,
  kind text not null,
  status text not null check (status in ('success','partial','failure')),
  summary text,
  details jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger notes_touch before update on public.notes for each row execute function public.touch_updated_at();

alter table public.checkins enable row level security;
alter table public.notes enable row level security;
alter table public.pin_positions enable row level security;
alter table public.job_runs enable row level security;

create policy "owner all checkins" on public.checkins for all to authenticated
  using (user_id = auth.uid() and public.is_owner()) with check (user_id = auth.uid() and public.is_owner());
create policy "owner all notes" on public.notes for all to authenticated
  using (user_id = auth.uid() and public.is_owner()) with check (user_id = auth.uid() and public.is_owner());
create policy "owner all pins" on public.pin_positions for all to authenticated
  using (user_id = auth.uid() and public.is_owner()) with check (user_id = auth.uid() and public.is_owner());
create policy "owner reads job runs" on public.job_runs for select to authenticated using (public.is_owner());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

create policy "owner reads own photos" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text and public.is_owner());
create policy "owner uploads own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text and public.is_owner());
create policy "owner updates own photos" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text and public.is_owner());
create policy "owner deletes own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text and public.is_owner());
