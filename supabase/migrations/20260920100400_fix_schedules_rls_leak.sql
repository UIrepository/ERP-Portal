-- Close a live leak found while building the public catalog.
--
-- The policy "Students can view all schedules" was:
--     using (exists (select 1 from user_enrollments where user_id = auth.uid()))
-- i.e. ANY enrolled student could read EVERY row of public.schedules — including
-- `link` (the meeting URL) and `stream_key` for batches they never bought. One
-- PostgREST call returned the join link for the entire organisation.
--
-- It cannot simply be dropped: StudentLiveClass.tsx reads schedules for MERGED
-- pairs, whose batch differs from the student's own, and schedules had no
-- merge-aware policy — the blanket one was silently carrying that case.
--
-- So we replace it with the same merge-aware shape already used by recordings
-- and notes. Merged live classes keep working; everything else stops being
-- readable.

drop policy if exists "Students can view all schedules" on public.schedules;

drop policy if exists "Merged students can view schedules" on public.schedules;
create policy "Merged students can view schedules"
  on public.schedules
  for select
  using (
    exists (
      select 1
        from public.subject_merges sm
        join public.user_enrollments ue
          on ue.user_id = auth.uid()
       where sm.is_active
         and (
              (sm.primary_batch     = schedules.batch
           and sm.primary_subject   = schedules.subject
           and sm.secondary_batch   = ue.batch_name
           and sm.secondary_subject = ue.subject_name)
            or
              (sm.secondary_batch   = schedules.batch
           and sm.secondary_subject = schedules.subject
           and sm.primary_batch     = ue.batch_name
           and sm.primary_subject   = ue.subject_name)
         )
    )
  );

-- "Students can view schedules for their enrollments" already covers the direct
-- case and stays as it is.
