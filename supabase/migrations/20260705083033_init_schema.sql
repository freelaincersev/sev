-- ============================================================================
-- Sev v0.1 — initial schema
--
-- Security model (strategy §7):
--   * Every user-owned table has user_id uuid references auth.users(id).
--   * Project-scoped tables also carry project_id.
--   * RLS is enabled on every table; the base policy is auth.uid() = user_id.
--   * Vector search is done through match_chunks(), which ALWAYS filters by the
--     authenticated user (and optionally a project) — never cross-user/project.
-- ============================================================================

-- Extensions ------------------------------------------------------------------
create extension if not exists vector with schema extensions;

-- Make the pgvector type/operators resolvable for the rest of this migration.
set search_path = public, extensions;

-- Helper functions ------------------------------------------------------------

-- Keep updated_at fresh on UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Create a profile row automatically for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ============================================================================
-- Tables
-- ============================================================================

-- profiles: 1:1 with auth.users -----------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  plan       text not null default 'free'
             check (plan in ('free', 'pro', 'pro_plus', 'lifetime')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- projects: a memory container ------------------------------------------------
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- sources: an uploaded file / URL / pasted text -------------------------------
create table public.sources (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  project_id    uuid not null references public.projects(id) on delete cascade,
  type          text not null check (type in ('markdown', 'txt', 'pdf', 'url', 'paste')),
  title         text not null,
  storage_path  text,
  source_url    text,
  status        text not null default 'uploaded'
                check (status in ('uploaded', 'processing', 'ready', 'error')),
  error_message text,
  content_hash  text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- source_versions: converted Markdown versions -------------------------------
create table public.source_versions (
  id             uuid primary key default gen_random_uuid(),
  source_id      uuid not null references public.sources(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  project_id     uuid not null references public.projects(id) on delete cascade,
  markdown_path  text,
  content_hash   text,
  parser_version text,
  created_at     timestamptz not null default now()
);

-- chunks: the unit of retrieval + citation -----------------------------------
create table public.chunks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade,
  source_id    uuid not null references public.sources(id) on delete cascade,
  content      text not null,
  heading_path text,
  page         int,
  chunk_index  int not null default 0,
  token_count  int,
  content_hash text,
  created_at   timestamptz not null default now()
);

-- embeddings: pgvector vectors for similarity search -------------------------
create table public.embeddings (
  id         uuid primary key default gen_random_uuid(),
  chunk_id   uuid not null references public.chunks(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  embedding  vector(1536) not null,
  model      text not null default 'text-embedding-3-small',
  created_at timestamptz not null default now()
);

-- chat_sessions ---------------------------------------------------------------
create table public.chat_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  project_id     uuid not null references public.projects(id) on delete cascade,
  title          text,
  model_provider text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- chat_messages ---------------------------------------------------------------
create table public.chat_messages (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.chat_sessions(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  project_id     uuid not null references public.projects(id) on delete cascade,
  role           text not null check (role in ('user', 'assistant', 'system')),
  content        text not null,
  used_chunk_ids uuid[] not null default '{}',
  created_at     timestamptz not null default now()
);

-- context_packets: the core Sev output ---------------------------------------
create table public.context_packets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  project_id       uuid not null references public.projects(id) on delete cascade,
  title            text not null,
  goal             text,
  target_llm       text,
  key_context      text,
  llm_ready_prompt text,
  content          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- packet_sources: which chunks/sources backed a packet ------------------------
create table public.packet_sources (
  id         uuid primary key default gen_random_uuid(),
  packet_id  uuid not null references public.context_packets(id) on delete cascade,
  chunk_id   uuid references public.chunks(id) on delete set null,
  source_id  uuid references public.sources(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- usage_events: rate limit / spend cap / billing analytics --------------------
create table public.usage_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  project_id    uuid references public.projects(id) on delete set null,
  event_type    text not null,
  tokens        int not null default 0,
  cost_estimate numeric(12, 6) not null default 0,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- ============================================================================
-- Indexes
-- ============================================================================
create index projects_user_id_idx        on public.projects (user_id);
create index sources_user_project_idx    on public.sources (user_id, project_id);
create index source_versions_source_idx  on public.source_versions (source_id);
create index chunks_user_project_idx     on public.chunks (user_id, project_id);
create index chunks_source_idx           on public.chunks (source_id);
create index embeddings_user_project_idx on public.embeddings (user_id, project_id);
create index embeddings_chunk_idx        on public.embeddings (chunk_id);
create index chat_sessions_user_project_idx on public.chat_sessions (user_id, project_id);
create index chat_messages_session_idx   on public.chat_messages (session_id);
create index context_packets_user_project_idx on public.context_packets (user_id, project_id);
create index packet_sources_packet_idx   on public.packet_sources (packet_id);
create index usage_events_user_idx       on public.usage_events (user_id, created_at desc);

-- Approximate nearest-neighbour index for cosine similarity.
create index embeddings_embedding_idx
  on public.embeddings
  using hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- updated_at triggers
-- ============================================================================
create trigger profiles_set_updated_at        before update on public.profiles        for each row execute function public.set_updated_at();
create trigger projects_set_updated_at         before update on public.projects         for each row execute function public.set_updated_at();
create trigger sources_set_updated_at          before update on public.sources          for each row execute function public.set_updated_at();
create trigger chat_sessions_set_updated_at    before update on public.chat_sessions    for each row execute function public.set_updated_at();
create trigger context_packets_set_updated_at  before update on public.context_packets  for each row execute function public.set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles        enable row level security;
alter table public.projects        enable row level security;
alter table public.sources         enable row level security;
alter table public.source_versions enable row level security;
alter table public.chunks          enable row level security;
alter table public.embeddings      enable row level security;
alter table public.chat_sessions   enable row level security;
alter table public.chat_messages   enable row level security;
alter table public.context_packets enable row level security;
alter table public.packet_sources  enable row level security;
alter table public.usage_events    enable row level security;

-- profiles keyed by id (which IS the auth user id).
create policy "profiles_owner" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- All other tables: owner-only access via user_id.
create policy "projects_owner" on public.projects
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "sources_owner" on public.sources
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "source_versions_owner" on public.source_versions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "chunks_owner" on public.chunks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "embeddings_owner" on public.embeddings
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "chat_sessions_owner" on public.chat_sessions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "chat_messages_owner" on public.chat_messages
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "context_packets_owner" on public.context_packets
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "packet_sources_owner" on public.packet_sources
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "usage_events_owner" on public.usage_events
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ============================================================================
-- Project-scoped vector search RPC
--
-- SECURITY INVOKER so RLS on embeddings/chunks applies, PLUS an explicit
-- auth.uid() filter. Cross-user / cross-project retrieval is impossible.
-- (strategy §7.4 required pattern)
-- ============================================================================
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
  join public.chunks c on c.id = e.chunk_id
  where e.user_id = (select auth.uid())
    and (p_project_id is null or e.project_id = p_project_id)
  order by e.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

grant execute on function public.match_chunks(vector, int, uuid) to authenticated;

-- ============================================================================
-- Storage: private bucket for original files
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('sources', 'sources', false)
on conflict (id) do nothing;

create policy "sources_bucket_owner"
  on storage.objects
  for all to authenticated
  using (bucket_id = 'sources' and owner = (select auth.uid()))
  with check (bucket_id = 'sources' and owner = (select auth.uid()));
