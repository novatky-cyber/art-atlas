create or replace function public.is_owner() returns boolean
language sql stable security invoker set search_path = public as $$
  select exists (select 1 from public.app_owner where owner_id = auth.uid());
$$;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
