
-- Replace get_current_user_role() policies on recordings with direct admin table checks
-- These policies call get_current_user_role() which queries profiles inside RLS evaluation
-- and may cause subtle recursion or timeout issues

-- RECORDINGS: Replace "Super admins can view all recordings"
DROP POLICY IF EXISTS "Super admins can view all recordings" ON public.recordings;
-- Already covered by "Admins can manage all recordings" and "Admins can view all recordings"

-- NOTES: Replace "Super admins can view all notes"  
DROP POLICY IF EXISTS "Super admins can view all notes" ON public.notes;
-- Already covered by "Admins can manage notes"

-- USER_ENROLLMENTS: Replace "Super admins can view all user enrollments"
DROP POLICY IF EXISTS "Super admins can view all user enrollments" ON public.user_enrollments;
-- Already covered by "Admins can view all enrollments"

-- EXAMS: Replace get_current_user_role() policies
DROP POLICY IF EXISTS "Super admins can view all exams" ON public.exams;
-- Already covered by "Admins can manage exams"

DROP POLICY IF EXISTS "Students can view exams for their subjects" ON public.exams;
-- Replace with enrollment-based check
CREATE POLICY "Students can view exams for their enrollments"
  ON public.exams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_enrollments ue
      WHERE ue.user_id = auth.uid()
        AND ue.batch_name = exams.batch
        AND ue.subject_name = exams.subject
    )
  );

-- FEEDBACK: Replace get_current_user_role() policy
DROP POLICY IF EXISTS "Super admins can view all feedback" ON public.feedback;
-- Already covered by admin policies or add one:
CREATE POLICY "Admins can view all feedback"
  ON public.feedback FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid()));

-- DPP_CONTENT: Replace get_current_user_batch/subjects policies
DROP POLICY IF EXISTS "Students can view DPP for their batch and subjects" ON public.dpp_content;
-- Already covered by "Students can view dpp_content for their enrollments"

-- NOTIFICATIONS: Replace get_current_user_role() policy
DROP POLICY IF EXISTS "Super admins can manage notifications" ON public.notifications;
CREATE POLICY "Admins can manage notifications"
  ON public.notifications FOR ALL
  USING (EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid()));

-- PROFILES: Replace get_current_user_role() policy  
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
-- Already covered by "Staff can view all profiles"

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';
