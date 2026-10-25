-- Ejecutar en Supabase antes de publicar el código que activa el historial.
create table if not exists public.exam_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  subject text not null default 'General' check (char_length(subject) <= 80),
  title text not null default 'Examen Numelio' check (char_length(title) <= 200),
  score numeric(4,2) not null check (score >= 0 and score <= 10),
  correct integer not null check (correct >= 0),
  total integer not null check (total between 1 and 20),
  created_at timestamptz not null default now(),
  constraint exam_history_correct_within_total check (correct <= total)
);

create index if not exists exam_history_user_created_at_idx
  on public.exam_history (user_id, created_at desc);

alter table public.exam_history enable row level security;
revoke all on public.exam_history from anon, authenticated;
grant select on public.exam_history to authenticated;
grant all on public.exam_history to service_role;
grant usage, select on sequence public.exam_history_id_seq to service_role;

drop policy if exists "Users can read their own exam history" on public.exam_history;
create policy "Users can read their own exam history"
  on public.exam_history
  for select
  to authenticated
  using ((select auth.uid()) = user_id);
