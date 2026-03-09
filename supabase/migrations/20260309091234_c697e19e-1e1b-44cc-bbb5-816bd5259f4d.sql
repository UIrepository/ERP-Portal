
-- STEP 1: Restore global schedule read for students (read-only timetable, no sensitive data)
CREATE POLICY "Students can view all schedules"
  ON public.schedules FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.user_enrollments WHERE user_enrollments.user_id = auth.uid())
  );

-- STEP 2: Allow merged-pair access to meeting_links
-- Students need to see meeting links for merged partner batches
DROP POLICY IF EXISTS "Enrolled students view active meeting links" ON public.meeting_links;

CREATE POLICY "Enrolled or merged students view active meeting links"
  ON public.meeting_links FOR SELECT
  USING (
    -- Direct enrollment
    (is_active = true AND EXISTS (
      SELECT 1 FROM public.user_enrollments ue
      WHERE ue.user_id = auth.uid()
        AND ue.batch_name = meeting_links.batch
        AND ue.subject_name = meeting_links.subject
    ))
    -- Merged pair access: student enrolled in a subject that is merged with this one
    OR (is_active = true AND EXISTS (
      SELECT 1 FROM public.subject_merges sm
      JOIN public.user_enrollments ue ON ue.user_id = auth.uid()
      WHERE sm.is_active = true
        AND (
          (sm.primary_batch = meeting_links.batch AND sm.primary_subject = meeting_links.subject
           AND sm.secondary_batch = ue.batch_name AND sm.secondary_subject = ue.subject_name)
          OR
          (sm.secondary_batch = meeting_links.batch AND sm.secondary_subject = meeting_links.subject
           AND sm.primary_batch = ue.batch_name AND sm.primary_subject = ue.subject_name)
        )
    ))
    -- Staff
    OR EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.managers WHERE managers.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.teachers WHERE teachers.user_id = auth.uid())
  );

-- STEP 3: Allow merged-pair access to active_classes
DROP POLICY IF EXISTS "Enrolled students can view active classes" ON public.active_classes;

CREATE POLICY "Enrolled or merged students can view active classes"
  ON public.active_classes FOR SELECT
  USING (
    -- Direct enrollment
    EXISTS (
      SELECT 1 FROM public.user_enrollments ue
      WHERE ue.user_id = auth.uid()
        AND ue.batch_name = active_classes.batch
        AND ue.subject_name = active_classes.subject
    )
    -- Merged pair access
    OR EXISTS (
      SELECT 1 FROM public.subject_merges sm
      JOIN public.user_enrollments ue ON ue.user_id = auth.uid()
      WHERE sm.is_active = true
        AND (
          (sm.primary_batch = active_classes.batch AND sm.primary_subject = active_classes.subject
           AND sm.secondary_batch = ue.batch_name AND sm.secondary_subject = ue.subject_name)
          OR
          (sm.secondary_batch = active_classes.batch AND sm.secondary_subject = active_classes.subject
           AND sm.primary_batch = ue.batch_name AND sm.primary_subject = ue.subject_name)
        )
    )
  );

-- STEP 4: Allow merged-pair access to doubts (students query doubts on merged recordings)
DROP POLICY IF EXISTS "Enrolled users can view doubts" ON public.doubts;

CREATE POLICY "Enrolled or merged users can view doubts"
  ON public.doubts FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_enrollments ue
      WHERE ue.user_id = auth.uid()
        AND ue.batch_name = doubts.batch
        AND ue.subject_name = doubts.subject
    )
    OR EXISTS (
      SELECT 1 FROM public.subject_merges sm
      JOIN public.user_enrollments ue ON ue.user_id = auth.uid()
      WHERE sm.is_active = true
        AND (
          (sm.primary_batch = doubts.batch AND sm.primary_subject = doubts.subject
           AND sm.secondary_batch = ue.batch_name AND sm.secondary_subject = ue.subject_name)
          OR
          (sm.secondary_batch = doubts.batch AND sm.secondary_subject = doubts.subject
           AND sm.primary_batch = ue.batch_name AND sm.primary_subject = ue.subject_name)
        )
    )
    OR EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.managers WHERE managers.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.teachers WHERE teachers.user_id = auth.uid())
  );
