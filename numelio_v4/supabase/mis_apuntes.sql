-- Ejecuta este archivo en Supabase > SQL Editor > New query > Run.
create table if not exists public.apuntes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  asignatura text not null default 'General',
  titulo text not null,
  contenido text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.apuntes enable row level security;
revoke all on table public.apuntes from anon, authenticated;
grant select, insert, update, delete on table public.apuntes to authenticated;

drop policy if exists "Cada usuario puede ver sus apuntes" on public.apuntes;
create policy "Cada usuario puede ver sus apuntes"
on public.apuntes for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Cada usuario puede crear sus apuntes" on public.apuntes;
create policy "Cada usuario puede crear sus apuntes"
on public.apuntes for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Cada usuario puede editar sus apuntes" on public.apuntes;
create policy "Cada usuario puede editar sus apuntes"
on public.apuntes for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Cada usuario puede borrar sus apuntes" on public.apuntes;
create policy "Cada usuario puede borrar sus apuntes"
on public.apuntes for delete to authenticated
using ((select auth.uid()) = user_id);

create index if not exists apuntes_user_id_idx on public.apuntes(user_id);
