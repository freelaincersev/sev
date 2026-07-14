-- ============================================================================
-- Provenance: which AI (or where) a saved answer came from — the "Source:
-- Perplexity" metadata. Complements intent (why it matters): origin is where
-- it came from. Free-text so it's not locked to a fixed vendor list.
--
-- Nullable + additive; existing owner RLS covers it.
-- ============================================================================

alter table public.sources add column origin text;
