
-- =============================================================
-- STEP 1: Fix privilege escalation on profiles
-- =============================================================

DROP TRIGGER IF EXISTS prevent_role_change ON public.profiles;
DROP FUNCTION IF EXISTS public.prevent_role_change_by_non_admin() CASCADE;

CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'Permission denied: cannot change role';
  END IF;

  IF OLD.premium_access IS DISTINCT FROM NEW.premium_access THEN
    RAISE EXCEPTION 'Permission denied: cannot change premium_access';
  END IF;

  IF OLD.bank_details IS DISTINCT FROM NEW.bank_details THEN
    RAISE EXCEPTION 'Permission denied: cannot change bank_details';
  END IF;

  IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
    RAISE EXCEPTION 'Permission denied: cannot change is_active';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_sensitive_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_sensitive_profile_columns();

-- =============================================================
-- STEP 2: Secure profile_basics (VIEW — restrict via grants)
-- =============================================================

REVOKE ALL ON public.profile_basics FROM anon;
GRANT SELECT ON public.profile_basics TO authenticated;

-- =============================================================
-- STEP 3: Lock down active_classes
-- =============================================================

DROP POLICY IF EXISTS "Authenticated users can view active classes" ON public.active_classes;

CREATE POLICY "Enrolled students can view active classes"
  ON public.active_classes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_enrollments
      WHERE user_enrollments.user_id = auth.uid()
        AND user_enrollments.batch_name = active_classes.batch
        AND user_enrollments.subject_name = active_classes.subject
    )
  );

CREATE POLICY "Staff can view all active classes"
  ON public.active_classes FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.managers WHERE managers.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.teachers WHERE teachers.user_id = auth.uid())
  );

-- =============================================================
-- STEP 4: Lock down doubts and doubt_answers
-- =============================================================

DROP POLICY IF EXISTS "Allow authenticated users to view all doubts" ON public.doubts;

CREATE POLICY "Enrolled users can view doubts"
  ON public.doubts FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_enrollments
      WHERE user_enrollments.user_id = auth.uid()
        AND user_enrollments.batch_name = doubts.batch
        AND user_enrollments.subject_name = doubts.subject
    )
    OR EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.managers WHERE managers.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.teachers WHERE teachers.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Allow authenticated users to view all answers" ON public.doubt_answers;

CREATE POLICY "Enrolled users can view doubt answers"
  ON public.doubt_answers FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.doubts d
      JOIN public.user_enrollments ue ON ue.batch_name = d.batch AND ue.subject_name = d.subject
      WHERE d.id = doubt_answers.doubt_id AND ue.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.managers WHERE managers.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.teachers WHERE teachers.user_id = auth.uid())
  );

-- =============================================================
-- STEP 5: Lock down meeting_links
-- =============================================================

DROP POLICY IF EXISTS "Authenticated users view active meeting links" ON public.meeting_links;

CREATE POLICY "Enrolled students view active meeting links"
  ON public.meeting_links FOR SELECT
  USING (
    (is_active = true AND EXISTS (
      SELECT 1 FROM public.user_enrollments
      WHERE user_enrollments.user_id = auth.uid()
        AND user_enrollments.batch_name = meeting_links.batch
        AND user_enrollments.subject_name = meeting_links.subject
    ))
    OR EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.managers WHERE managers.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.teachers WHERE teachers.user_id = auth.uid())
  );

-- =============================================================
-- STEP 6: Remove overly broad schedule policies
-- =============================================================

DROP POLICY IF EXISTS "Students can view all schedules" ON public.schedules;
DROP POLICY IF EXISTS "Students can view schedules for their batch" ON public.schedules;

-- =============================================================
-- STEP 7: Lock down message_likes
-- =============================================================

DROP POLICY IF EXISTS "Authenticated users can view likes" ON public.message_likes;

CREATE POLICY "Users can view likes on accessible messages"
  ON public.message_likes FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.community_messages cm
      JOIN public.user_enrollments ue ON ue.batch_name = cm.batch AND ue.subject_name = cm.subject
      WHERE cm.id = message_likes.message_id AND ue.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.managers WHERE managers.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.teachers WHERE teachers.user_id = auth.uid())
  );
