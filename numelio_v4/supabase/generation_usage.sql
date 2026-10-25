-- Ejecutar una vez en el SQL Editor de Supabase antes del lanzamiento.
create table if not exists public.generation_usage (
  id bigint generated always as identity primary key,
  user_id uuid null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists generation_usage_created_at_idx on public.generation_usage (created_at);
create index if not exists generation_usage_user_created_at_idx on public.generation_usage (user_id, created_at);
alter table public.generation_usage enable row level security;
revoke all on public.generation_usage from anon, authenticated;

create or replace function public.consume_generation_limit(
  p_user_id uuid,
  p_ip_hash text,
  p_daily_limit integer default 10
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare used_count integer;
begin
  if p_daily_limit is null or p_daily_limit < 1 then
    raise exception 'p_daily_limit must be a positive integer';
  end if;
  if p_user_id is null and coalesce(p_ip_hash, '') = '' then
    raise exception 'p_ip_hash is required for anonymous usage';
  end if;

  -- 64-bit advisory key reduces collisions between unrelated users/IP hashes.
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_user_id::text, p_ip_hash), 0));
  if p_user_id is not null then
    select count(*) into used_count from public.generation_usage
      where user_id = p_user_id and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  else
    select count(*) into used_count from public.generation_usage
      where user_id is null and ip_hash = p_ip_hash and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  end if;
  if used_count >= p_daily_limit then return false; end if;
  insert into public.generation_usage(user_id, ip_hash) values (p_user_id, p_ip_hash);
  return true;
end;
$$;
revoke all on function public.consume_generation_limit(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.consume_generation_limit(uuid, text, integer) to service_role;
