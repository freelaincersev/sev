-- ============================================================================
-- Cross-project reuse (#3): source-level similarity infrastructure.
--
-- The heaviest missing piece for "this project looks related to a past one —
-- reuse it?". Chunk embeddings already exist (pgvector), but chunk-vs-chunk
-- comparison across projects is N×M and too granular to name WHICH source to
-- reuse. So we roll each source up to a single centroid (`avg_embedding`, the
-- mean of its chunk vectors) — a cheap, meaningful unit that maps directly to
-- "reuse the market-size doc / the competitor doc".
--
-- Project relatedness is DERIVED from source similarity in the app layer
-- (group related_sources by project), so no project-centroid column is needed.
--
-- Isolation invariant (same as match_chunks): security invoker + an explicit
-- auth.uid() filter. v1 is personal-only — team visibility is intentionally NOT
-- joined here; cross-project team reuse waits for the team UI.
-- ============================================================================

-- pgvector type + operators resolvable for the vector column / index / RPC.
set search_path = public, extensions;

-- 1) Per-source centroid. Nullable + additive; existing owner RLS covers it.
alter table public.sources add column avg_embedding vector(1536);

-- Cosine index for ranking other-project sources against a query centroid.
-- NULLs are skipped; harmless while most rows are still unpopulated.
create index if not exists sources_avg_embedding_idx
  on public.sources
  using hnsw (avg_embedding vector_cosine_ops);

-- 2) Backfill existing sources from the mean of their chunk embeddings.
--    embeddings has no source_id, so join through chunks. pgvector's avg()
--    aggregate (>= 0.5.0) does the element-wise mean.
update public.sources s
set avg_embedding = sub.centroid
from (
  select c.source_id, avg(e.embedding) as centroid
  from public.embeddings e
  join public.chunks c on c.id = e.chunk_id
  group by c.source_id
) sub
where sub.source_id = s.id;

-- 3) related_sources: rank sources in OTHER projects by similarity to the
--    current project's centroid (mean of its source centroids). Returns the
--    metadata the reuse UI needs (title, owning project, intent, origin). The
--    app groups these by project to surface "related to X".
--
--    Personal-only: every candidate is filtered to auth.uid()-owned rows, and
--    the current project is excluded, so this can only ever surface the user's
--    own past work.
create function public.related_sources(
  p_project_id uuid,
  match_count  int default 20
)
returns table (
  source_id         uuid,
  source_title      text,
  source_project_id uuid,
  project_title     text,
  intent            text,
  origin            text,
  similarity        float
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with me as (
    select avg(s.avg_embedding) as centroid
    from public.sources s
    where s.project_id = p_project_id
      and s.user_id = (select auth.uid())
      and s.avg_embedding is not null
  )
  select
    s.id                                   as source_id,
    s.title                                as source_title,
    s.project_id                           as source_project_id,
    p.title                                as project_title,
    s.intent                               as intent,
    s.origin                               as origin,
    1 - (s.avg_embedding <=> me.centroid)  as similarity
  from public.sources s
  join public.projects p on p.id = s.project_id
  cross join me
  where s.user_id = (select auth.uid())
    and s.project_id <> p_project_id
    and s.status = 'ready'
    and s.avg_embedding is not null
    and me.centroid is not null
  order by s.avg_embedding <=> me.centroid
  limit greatest(match_count, 1);
$$;

grant execute on function public.related_sources(uuid, int) to authenticated;
