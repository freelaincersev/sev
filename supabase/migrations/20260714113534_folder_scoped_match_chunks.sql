-- ============================================================================
-- Folder-scoped retrieval: add an optional p_folder_id to match_chunks so the
-- Ask flow can answer using ONLY the sources in a selected folder.
--
-- A source with folder_id = null lives at the project root; passing null (the
-- default) keeps the whole-project behavior unchanged. The sources join and the
-- user/team visibility filter are untouched, so scoping is purely additive and
-- cannot widen access.
--
-- Adding a parameter changes the signature, so the 3-arg version must be dropped
-- first (create or replace would leave an ambiguous overload behind).
-- ============================================================================

-- pgvector type resolvable for the signature below (fresh session per migration).
set search_path = public, extensions;

drop function if exists public.match_chunks(vector, int, uuid);

create function public.match_chunks(
  query_embedding vector(1536),
  match_count     int default 8,
  p_project_id    uuid default null,
  p_folder_id     uuid default null
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
    and (p_folder_id is null or s.folder_id = p_folder_id)
  order by e.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

grant execute on function public.match_chunks(vector, int, uuid, uuid) to authenticated;
