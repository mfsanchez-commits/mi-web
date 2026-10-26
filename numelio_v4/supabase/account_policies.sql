-- Ejecutar una vez en Supabase SQL Editor para completar permisos de cuenta.
-- Las políticas son por propietario y no permiten leer ni modificar datos ajenos.

alter table public.exam_history enable row level security;
grant select, insert on public.exam_history to authenticated;
drop policy if exists "Users can read their own exam history" on public.exam_history;
create policy "Users can read their own exam history"
  on public.exam_history for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Users can insert their own exam history" on public.exam_history;
create policy "Users can insert their own exam history"
  on public.exam_history for insert to authenticated
  with check ((select auth.uid()) = user_id);

alter table public.flashcards enable row level security;
grant select, insert, update, delete on public.flashcards to authenticated;
drop policy if exists "Cada usuario ve sus flashcards" on public.flashcards;
create policy "Cada usuario ve sus flashcards"
  on public.flashcards for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Cada usuario crea sus flashcards" on public.flashcards;
create policy "Cada usuario crea sus flashcards"
  on public.flashcards for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Cada usuario puede editar sus flashcards" on public.flashcards;
create policy "Cada usuario puede editar sus flashcards"
  on public.flashcards for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Cada usuario elimina sus flashcards" on public.flashcards;
create policy "Cada usuario elimina sus flashcards"
  on public.flashcards for delete to authenticated
  using ((select auth.uid()) = user_id);

alter table public.generation_usage enable row level security;
revoke all on public.generation_usage from anon, authenticated;
drop policy if exists "No direct access to usage counters" on public.generation_usage;
create policy "No direct access to usage counters"
  on public.generation_usage as restrictive for all to anon, authenticated
  using (false) with check (false);
