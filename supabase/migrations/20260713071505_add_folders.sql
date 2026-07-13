-- ============================================================================
-- Sev — folders (left-sidebar file structure)
--
-- A project's sources can be organised into (optionally nested) folders.
-- Follows the same isolation invariant as every other table (strategy §7.4):
--   * user_id on every row; project-scoped rows also carry project_id.
--   * RLS enabled; base policy is auth.uid() = user_id.
-- avatar_preset / color are nullable and unused for now — reserved for the
-- later "folder character" feature.
-- ============================================================================

create table public.folders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  project_id    uuid not null references public.projects(id) on delete cascade,
  name          text not null,
  -- Nested folders: a parent in the same table. Deleting a parent promotes its
  -- children to the project root (set null) rather than cascading a delete.
  parent_id     uuid references public.folders(id) on delete set null,
  avatar_preset text,
  color         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- sources gain an optional folder. A source with folder_id = null lives at the
-- project root. Deleting a folder drops its sources back to the root.
alter table public.sources
  add column folder_id uuid references public.folders(id) on delete set null;

-- Indexes ---------------------------------------------------------------------
create index folders_user_project_idx on public.folders (user_id, project_id);
create index folders_parent_idx       on public.folders (parent_id);
create index sources_folder_idx       on public.sources (folder_id);

-- updated_at trigger ----------------------------------------------------------
create trigger folders_set_updated_at
  before update on public.folders
  for each row execute function public.set_updated_at();

-- Row Level Security ----------------------------------------------------------
alter table public.folders enable row level security;

create policy "folders_owner" on public.folders
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
