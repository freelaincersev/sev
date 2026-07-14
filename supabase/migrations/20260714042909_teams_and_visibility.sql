-- ============================================================================
-- D-1 — Teams + per-source visibility (schema only; no UI yet)
--
-- Extends the owner-only model (auth.uid() = user_id) with team-shared READS.
-- Design decisions (2026-07-14 review):
--   * Membership lives in a WRITE-CONTROLLED join table team_members, NOT on
--     profiles.team_id — a user must not be able to self-join a team by editing
--     their own profile row, which would break data isolation.
--   * is_team_member() is SECURITY DEFINER so policies can check membership
--     without recursively triggering RLS on team_members.
--   * Sharing only WIDENS SELECT. INSERT/UPDATE/DELETE stay owner-only
--     (user_id = auth.uid()); a team lead cannot edit/delete a member's row.
--   * sources is the unit of sharing (visibility per source, per PRD_v2 §5/§7).
--     projects.visibility gates whether the Vault is listable by members.
--   * chunks/embeddings carry NO visibility column — their team-read policies and
--     match_chunks join back to sources. If the vector scan gets slow at scale,
--     denormalize visibility/team_id onto embeddings with a sync trigger.
--   * Packets, chats, source_versions, usage_events stay personal in this cut.
-- ============================================================================

-- Make the pgvector type resolvable for the match_chunks signature below
-- (migrations run in a fresh session; the init migration set this too).
set search_path = public, extensions;

-- ── Tables ──────────────────────────────────────────────────────────────────

create table public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  plan       text not null default 'team',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Membership is separate from profiles so its writes can be locked down.
create table public.team_members (
  team_id    uuid not null references public.teams(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- ── Membership helper (SECURITY DEFINER avoids recursive RLS) ────────────────
-- Bypasses RLS on team_members so policies on OTHER tables can ask
-- "is the caller in this team?" without re-entering team_members' own policies.
create function public.is_team_member(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team and user_id = (select auth.uid())
  );
$$;

grant execute on function public.is_team_member(uuid) to authenticated;

-- ── Extend projects + sources ────────────────────────────────────────────────
alter table public.projects
  add column team_id    uuid references public.teams(id) on delete set null,
  add column visibility text not null default 'personal'
             check (visibility in ('personal', 'team'));

alter table public.sources
  add column team_id    uuid references public.teams(id) on delete set null,
  add column visibility text not null default 'personal'
             check (visibility in ('personal', 'team'));

-- ── Indexes ──────────────────────────────────────────────────────────────────
create index team_members_user_idx on public.team_members (user_id);
create index projects_team_idx      on public.projects (team_id);
create index sources_team_idx       on public.sources (team_id, visibility);
-- storage-policy lookup joins storage.objects.name = sources.storage_path.
create index sources_storage_path_idx on public.sources (storage_path);

-- ── updated_at trigger for teams ──────────────────────────────────────────────
create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

-- ── RLS: teams ────────────────────────────────────────────────────────────────
alter table public.teams enable row level security;

create policy "teams_select" on public.teams
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_team_member(id));

create policy "teams_insert" on public.teams
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "teams_update" on public.teams
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "teams_delete" on public.teams
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ── RLS: team_members ─────────────────────────────────────────────────────────
-- Read: co-members of a team you're in can see each other.
-- Write: only the team OWNER adds/updates members (prevents self-join, the core
-- isolation hole in the naive profiles.team_id model). A member may remove
-- themselves (leave).
alter table public.team_members enable row level security;

create policy "team_members_select" on public.team_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_team_member(team_id));

create policy "team_members_insert" on public.team_members
  for insert to authenticated
  with check (
    exists (
      select 1 from public.teams t
      where t.id = team_id and t.owner_id = (select auth.uid())
    )
  );

create policy "team_members_update" on public.team_members
  for update to authenticated
  using (
    exists (
      select 1 from public.teams t
      where t.id = team_id and t.owner_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.teams t
      where t.id = team_id and t.owner_id = (select auth.uid())
    )
  );

create policy "team_members_delete" on public.team_members
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.teams t
      where t.id = team_id and t.owner_id = (select auth.uid())
    )
  );

-- ── RLS: projects (replace owner-only with split owner / team-read) ───────────
drop policy "projects_owner" on public.projects;

create policy "projects_select" on public.projects
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (visibility = 'team' and public.is_team_member(team_id))
  );

-- Writes stay owner-only; team_id may only point at a team you belong to, and
-- visibility='team' requires such a team.
create policy "projects_write_insert" on public.projects
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (team_id is null or public.is_team_member(team_id))
    and (visibility = 'personal' or (team_id is not null and public.is_team_member(team_id)))
  );

create policy "projects_write_update" on public.projects
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (team_id is null or public.is_team_member(team_id))
    and (visibility = 'personal' or (team_id is not null and public.is_team_member(team_id)))
  );

create policy "projects_write_delete" on public.projects
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── RLS: sources (owner / team-read; the actual shared Vault content) ─────────
drop policy "sources_owner" on public.sources;

create policy "sources_select" on public.sources
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (visibility = 'team' and public.is_team_member(team_id))
  );

create policy "sources_write_insert" on public.sources
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (team_id is null or public.is_team_member(team_id))
    and (visibility = 'personal' or (team_id is not null and public.is_team_member(team_id)))
    -- must file into a project you can actually see
    and exists (
      select 1 from public.projects p
      where p.id = project_id
        and (p.user_id = (select auth.uid())
             or (p.visibility = 'team' and public.is_team_member(p.team_id)))
    )
  );

create policy "sources_write_update" on public.sources
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (team_id is null or public.is_team_member(team_id))
    and (visibility = 'personal' or (team_id is not null and public.is_team_member(team_id)))
  );

create policy "sources_write_delete" on public.sources
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ── RLS: chunks (team-read via parent source; writes owner-only) ──────────────
drop policy "chunks_owner" on public.chunks;

create policy "chunks_select" on public.chunks
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.sources s
      where s.id = source_id
        and s.visibility = 'team'
        and public.is_team_member(s.team_id)
    )
  );

create policy "chunks_write" on public.chunks
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── RLS: embeddings (team-read via chunk → source; writes owner-only) ─────────
drop policy "embeddings_owner" on public.embeddings;

create policy "embeddings_select" on public.embeddings
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.chunks c
      join public.sources s on s.id = c.source_id
      where c.id = chunk_id
        and s.visibility = 'team'
        and public.is_team_member(s.team_id)
    )
  );

create policy "embeddings_write" on public.embeddings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ── match_chunks: merge personal + team-shared retrieval ──────────────────────
-- security invoker keeps RLS in force; the explicit predicate is defense in
-- depth. Personal sources of other members stay invisible (visibility gate).
create or replace function public.match_chunks(
  query_embedding vector(1536),
  match_count     int default 8,
  p_project_id    uuid default null
)
returns table (
  chunk_id     uuid,
  source_id    uuid,
  content      text,
  heading_path text,
  page         int,
  similarity   float
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    c.id           as chunk_id,
    c.source_id    as source_id,
    c.content      as content,
    c.heading_path as heading_path,
    c.page         as page,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.embeddings e
  join public.chunks c  on c.id = e.chunk_id
  join public.sources s on s.id = c.source_id
  where (
      e.user_id = (select auth.uid())
      or (s.visibility = 'team' and public.is_team_member(s.team_id))
    )
    and (p_project_id is null or e.project_id = p_project_id)
  order by e.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

grant execute on function public.match_chunks(vector, int, uuid) to authenticated;

-- ── Storage: let team members download team-shared originals ──────────────────
-- The owner policy (owner = auth.uid()) stays; this ADDS read for team members
-- by resolving the object path back to its source. No service_role.
create policy "sources_bucket_team_read"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'sources'
    and exists (
      select 1 from public.sources s
      where s.storage_path = name
        and s.visibility = 'team'
        and public.is_team_member(s.team_id)
    )
  );
