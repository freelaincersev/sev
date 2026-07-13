-- ============================================================================
-- Sev — path-based isolation for the private `sources` storage bucket
--
-- Originals are stored at {user_id}/{project_id}/{source_id}/{filename}. The
-- init migration guarded the bucket by `owner = auth.uid()`; we tighten it to
-- the documented path rule so a user can only touch objects whose FIRST path
-- segment is their own uid (strategy §7.4 / §7.5). Cross-user access via
-- storage is therefore impossible even if `owner` were ever unset.
-- ============================================================================

drop policy if exists "sources_bucket_owner" on storage.objects;

create policy "sources_bucket_owner"
  on storage.objects
  for all to authenticated
  using (
    bucket_id = 'sources'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'sources'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
