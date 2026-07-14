-- A-3: click a source → one-time LLM summary, stored on the row.
-- Generated once (GPT-4o mini) and cached; RLS on sources already scopes
-- reads/writes to the owner, so no policy changes are needed.
alter table public.sources
  add column summary text,
  add column summary_model text,
  add column summary_created_at timestamptz;
