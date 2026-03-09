
-- 1. Recordings: add merge-aware SELECT policy
CREATE POLICY "Merged students can view recordings"
  ON public.recordings FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.subject_merges sm
      JOIN public.user_enrollments ue ON ue.user_id = auth.uid()
      WHERE sm.is_active = true
        AND (
          (sm.primary_batch = recordings.batch AND sm.primary_subject = recordings.subject
           AND sm.secondary_batch = ue.batch_name AND sm.secondary_subject = ue.subject_name)
          OR
          (sm.secondary_batch = recordings.batch AND sm.secondary_subject = recordings.subject
           AND sm.primary_batch = ue.batch_name AND sm.primary_subject = ue.subject_name)
        )
    )
  );

-- 2. Notes: add merge-aware SELECT policy
CREATE POLICY "Merged students can view notes"
  ON public.notes FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.subject_merges sm
      JOIN public.user_enrollments ue ON ue.user_id = auth.uid()
      WHERE sm.is_active = true
        AND (
          (sm.primary_batch = notes.batch AND sm.primary_subject = notes.subject
           AND sm.secondary_batch = ue.batch_name AND sm.secondary_subject = ue.subject_name)
          OR
          (sm.secondary_batch = notes.batch AND sm.secondary_subject = notes.subject
           AND sm.primary_batch = ue.batch_name AND sm.primary_subject = ue.subject_name)
        )
    )
  );

-- 3. Drop stale schedules policy that uses get_current_user_role()
DROP POLICY IF EXISTS "Super admins can view all schedules" ON public.schedules;

-- 4. Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';
