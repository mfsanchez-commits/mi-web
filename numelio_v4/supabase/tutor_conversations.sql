-- Conversaciones del profesor IA de Numelio. Cada alumno solo puede acceder a sus propios chats.
create table if not exists public.tutor_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null default 'Nueva conversación',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tutor_conversations_title_length check (char_length(title) between 1 and 120),
  constraint tutor_conversations_messages_array check (jsonb_typeof(messages) = 'array' and jsonb_array_length(messages) <= 100)
);
create index if not exists tutor_conversations_user_updated_idx
  on public.tutor_conversations (user_id, updated_at desc);
alter table public.tutor_conversations enable row level security;
revoke all on table public.tutor_conversations from anon, authenticated;
grant select, insert, update, delete on table public.tutor_conversations to authenticated;
drop policy if exists "Cada usuario ve sus conversaciones del profesor" on public.tutor_conversations;
create policy "Cada usuario ve sus conversaciones del profesor"
  on public.tutor_conversations for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Cada usuario crea sus conversaciones del profesor" on public.tutor_conversations;
create policy "Cada usuario crea sus conversaciones del profesor"
  on public.tutor_conversations for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Cada usuario edita sus conversaciones del profesor" on public.tutor_conversations;
create policy "Cada usuario edita sus conversaciones del profesor"
  on public.tutor_conversations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Cada usuario borra sus conversaciones del profesor" on public.tutor_conversations;
create policy "Cada usuario borra sus conversaciones del profesor"
  on public.tutor_conversations for delete to authenticated
  using ((select auth.uid()) = user_id);
