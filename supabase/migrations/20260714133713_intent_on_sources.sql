-- ============================================================================
-- Intent capture: one line of "why this matters for the project", saved with a
-- source. It's the one signal the LLM providers can't see (they read the
-- artifact, not the user's purpose) — so it turns AI output into user knowledge
-- and improves future retrieval. Stored here for display/reuse; the ingest also
-- prepends it to the embedded content so it's a retrieval signal immediately.
--
-- Nullable + additive; existing RLS (owner policy) already covers all columns.
-- ============================================================================

alter table public.sources add column intent text;
