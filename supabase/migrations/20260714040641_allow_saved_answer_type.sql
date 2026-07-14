-- B-1: "save answer to memory" — answers saved as sources use a dedicated
-- type so they're distinguishable from user-added material (and retrievable
-- like any other source, which is B-3 for free).
alter table public.sources
  drop constraint sources_type_check;
alter table public.sources
  add constraint sources_type_check
  check (type in ('markdown', 'txt', 'pdf', 'url', 'paste', 'saved_answer'));
