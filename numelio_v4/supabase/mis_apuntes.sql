-- Ejecuta este script completo en Supabase > SQL Editor > Run.
create table if not exists public.apuntes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  asignatura text not null default 'General',
  titulo text not null,
  contenido text not null default '',
  archivo_nombre text,
  archivo_path text,
  archivo_tipo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.apuntes add column if not exists archivo_nombre text;
alter table public.apuntes add column if not exists archivo_path text;
alter table public.apuntes add column if not exists archivo_tipo text;
alter table public.apuntes enable row level security;
revoke all on table public.apuntes from anon, authenticated;
grant select, insert, update, delete on table public.apuntes to authenticated;

drop policy if exists "Cada usuario puede ver sus apuntes" on public.apuntes;
create policy "Cada usuario puede ver sus apuntes" on public.apuntes for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Cada usuario puede crear sus apuntes" on public.apuntes;
create policy "Cada usuario puede crear sus apuntes" on public.apuntes for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Cada usuario puede editar sus apuntes" on public.apuntes;
create policy "Cada usuario puede editar sus apuntes" on public.apuntes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Cada usuario puede borrar sus apuntes" on public.apuntes;
create policy "Cada usuario puede borrar sus apuntes" on public.apuntes for delete to authenticated using ((select auth.uid()) = user_id);
create index if not exists apuntes_user_id_idx on public.apuntes(user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('archivos-apuntes', 'archivos-apuntes', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=10485760, allowed_mime_types=array['application/pdf','image/jpeg','image/png','image/webp'];

-- Eliminar la política antigua duplicada si quedó de una configuración anterior.
drop policy if exists "Usuarios gestionan sus propios archivos" on storage.objects;
drop policy if exists "Cada usuario gestiona sus archivos de apuntes" on storage.objects;
create policy "Cada usuario gestiona sus archivos de apuntes" on storage.objects for all to authenticated
using (bucket_id = 'archivos-apuntes' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'archivos-apuntes' and (storage.foldername(name))[1] = (select auth.uid())::text);


-- Tarjetas de memoria guardadas por cada usuario.
create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  asignatura text not null default 'General',
  titulo text not null default 'Tarjetas de estudio',
  tarjetas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.flashcards enable row level security;
revoke all on table public.flashcards from anon, authenticated;
grant select, insert, delete on table public.flashcards to authenticated;
drop policy if exists "Cada usuario ve sus flashcards" on public.flashcards;
create policy "Cada usuario ve sus flashcards" on public.flashcards for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Cada usuario crea sus flashcards" on public.flashcards;
create policy "Cada usuario crea sus flashcards" on public.flashcards for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Cada usuario elimina sus flashcards" on public.flashcards;
create policy "Cada usuario elimina sus flashcards" on public.flashcards for delete to authenticated using ((select auth.uid()) = user_id);
create index if not exists flashcards_user_id_idx on public.flashcards(user_id);
