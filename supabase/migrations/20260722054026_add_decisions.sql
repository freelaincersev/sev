-- ============================================================================
-- Decision Records (MVP wedge, PRD v3 §8).
--
-- A decision extracted from AI work conversations: what was decided, why,
-- which alternatives were rejected and for what reason — with VERBATIM
-- evidence quotes from the source (extraction refuses fields it cannot cite;
-- the app layer additionally verifies each quote is a real substring).
--
-- Design decisions carried from 방향성_v2 / PRD_v3:
--   * Postgres is the source of truth; Markdown is a mirror generated on
--     verification (export layer), never the store.
--   * `supersedes` models decision evolution (07-03 tentative → 07-05 final):
--     the new row points at the old one, and the app flips the old row's
--     status to 'superseded'. No automatic merging — merge candidates are
--     surfaced for human confirmation.
--   * `verification` gates injection: a user's own records may be served
--     'unverified' (labelled), other people's records only when 'verified'.
--     MVP is personal-only (owner RLS); team read arrives with the team UI.
--   * Uploaded chat transcripts become sources with type='conversation' so
--     the existing ingest/storage/RLS machinery applies unchanged.
-- ============================================================================

-- pgvector type + operators resolvable for the vector column / index / RPC.
set search_path = public, extensions;

-- 1) Allow uploaded AI-chat transcripts as a source type.
alter table public.sources
  drop constraint sources_type_check;
alter table public.sources
  add constraint sources_type_check
  check (type in ('markdown', 'txt', 'pdf', 'url', 'paste', 'saved_answer', 'conversation'));

-- 2) The decision record itself.
create table public.decisions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  project_id    uuid not null references public.projects(id) on delete cascade,
  source_id     uuid references public.sources(id) on delete set null,

  decision      text not null,                          -- one sentence: what was decided
  rationale     text,                                   -- why (only when evidenced)
  alternatives  jsonb not null default '[]'::jsonb,     -- [{option, rejection_reason}]
  evidence      jsonb not null default '[]'::jsonb,     -- [{quote, location}] verbatim spans
  conditions    text,                                   -- context/assumptions at decision time
  decided_at    date,
  importance    text check (importance in ('high', 'medium', 'low')),

  status        text not null default 'active'
                check (status in ('active', 'superseded')),
  supersedes    uuid references public.decisions(id) on delete set null,

  verification  text not null default 'unverified'
                check (verification in ('unverified', 'verified')),
  verified_at   timestamptz,

  embedding     vector(1536),                           -- decision+rationale, for retrieval

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index decisions_project_idx   on public.decisions (project_id, status);
create index decisions_user_idx      on public.decisions (user_id);
create index decisions_embedding_idx on public.decisions
  using hnsw (embedding vector_cosine_ops);

create trigger decisions_set_updated_at
  before update on public.decisions
  for each row execute function public.set_updated_at();

-- 3) RLS: owner-only (same invariant as every user-owned table).
alter table public.decisions enable row level security;

create policy "decisions_owner" on public.decisions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 4) Retrieval gateway (mirrors match_chunks): security invoker + explicit
--    auth.uid() filter, optional project scope. Superseded rows are returned
--    too (history has answer value) — the caller labels them by status.
create function public.match_decisions(
  query_embedding vector(1536),
  match_count     int default 8,
  p_project_id    uuid default null
)
returns table (
  id           uuid,
  project_id   uuid,
  decision     text,
  rationale    text,
  alternatives jsonb,
  evidence     jsonb,
  conditions   text,
  decided_at   date,
  status       text,
  verification text,
  similarity   float
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    d.id, d.project_id, d.decision, d.rationale, d.alternatives, d.evidence,
    d.conditions, d.decided_at, d.status, d.verification,
    1 - (d.embedding <=> query_embedding) as similarity
  from public.decisions d
  where d.user_id = (select auth.uid())
    and (p_project_id is null or d.project_id = p_project_id)
    and d.embedding is not null
  order by d.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

grant execute on function public.match_decisions(vector, int, uuid) to authenticated;
