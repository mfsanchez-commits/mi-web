-- Ejecutar una vez en el SQL Editor de Supabase antes de activar los límites.
create table if not exists public.generation_usage (
  id bigint generated always as identity primary key,
  user_id uuid null,
  ip_hash text not null,
  feature text not null default 'legacy',
  created_at timestamptz not null default now()
);

alter table public.generation_usage add column if not exists feature text not null default 'legacy';
create index if not exists generation_usage_created_at_idx on public.generation_usage (created_at);
create index if not exists generation_usage_user_created_at_idx on public.generation_usage (user_id, created_at);
create index if not exists generation_usage_anon_ip_created_at_idx
  on public.generation_usage (ip_hash, created_at) where user_id is null;
create index if not exists generation_usage_feature_created_at_idx
  on public.generation_usage (feature, created_at);

alter table public.generation_usage enable row level security;
revoke all on public.generation_usage from anon, authenticated;

-- Remove the previous RPC signature so an old daily-only endpoint cannot remain callable.
drop function if exists public.consume_generation_limit(uuid, text, integer);

create or replace function public.consume_generation_limit(
  p_user_id uuid,
  p_ip_hash text,
  p_feature text,
  p_daily_limit integer,
  p_monthly_limit integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  used_today integer;
  used_this_month integer;
  utc_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  utc_month_start timestamptz := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
begin
  if p_daily_limit is null or p_daily_limit < 1 or p_monthly_limit is null or p_monthly_limit < 1 then
    raise exception 'usage limits must be positive integers';
  end if;
  if p_user_id is null and coalesce(p_ip_hash, '') = '' then
    raise exception 'p_ip_hash is required for anonymous usage';
  end if;
  if p_feature not in ('exam_generation', 'exam_grading', 'flashcards', 'oral_exam_generation', 'oral_answer_grading', 'tutor_reply') then
    raise exception 'invalid generation feature';
  end if;

  -- Serialize by account/IP so concurrent requests cannot exceed either quota.
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_user_id::text, p_ip_hash), 0));
  if p_user_id is not null then
    select count(*) filter (where created_at >= utc_day_start), count(*)
      into used_today, used_this_month
      from public.generation_usage
      where user_id = p_user_id and created_at >= utc_month_start;
  else
    select count(*) filter (where created_at >= utc_day_start), count(*)
      into used_today, used_this_month
      from public.generation_usage
      where user_id is null and ip_hash = p_ip_hash and created_at >= utc_month_start;
  end if;

  if used_today >= p_daily_limit or used_this_month >= p_monthly_limit then return false; end if;
  insert into public.generation_usage(user_id, ip_hash, feature)
    values (p_user_id, p_ip_hash, p_feature);
  return true;
end;
$$;

revoke all on function public.consume_generation_limit(uuid, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_generation_limit(uuid, text, text, integer, integer) to service_role;
