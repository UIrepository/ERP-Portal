
-- 1. Revoke DELETE from anon on all public tables
REVOKE DELETE ON ALL TABLES IN SCHEMA public FROM anon;

-- 2. Tighten existing DELETE policies to authenticated only
DROP POLICY IF EXISTS "Authenticated users can delete their own profile" ON public.profiles;
CREATE POLICY "Authenticated users can delete their own profile"
  ON public.profiles FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own community messages" ON public.community_messages;
CREATE POLICY "Users can delete their own community messages"
  ON public.community_messages FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only delete their own doubts" ON public.doubts;
CREATE POLICY "Users can only delete their own doubts"
  ON public.doubts FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only delete their own answers" ON public.doubt_answers;
CREATE POLICY "Users can only delete their own answers"
  ON public.doubt_answers FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own reactions" ON public.message_likes;
DROP POLICY IF EXISTS "Users can unlike messages" ON public.message_likes;
CREATE POLICY "Users can delete their own reactions"
  ON public.message_likes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 3. Add admin-only DELETE policies for unprotected tables
CREATE POLICY "Only admins can delete" ON public.activity_logs FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Only admins can delete" ON public.analytics_events FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Only admins can delete" ON public.chat_messages FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Only admins can delete" ON public.class_attendance FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Only admins can delete" ON public.direct_messages FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Only admins can delete" ON public.feedback FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Only admins can delete" ON public.schedules FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Only admins can delete" ON public.student_activities FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Only admins can delete" ON public.user_sessions FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Only admins can delete" ON public.video_progress FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Only admins can delete" ON public.payments FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Only admins can delete" ON public.notifications FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Only admins can delete" ON public.exams FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Only admins can delete" ON public.dpp_content FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Only admins can delete" ON public.google_groups FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Only admins can delete" ON public.maintenance_settings FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Only admins can delete" ON public.managers FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Only admins can delete" ON public.schedule_requests FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Only admins can delete" ON public.subject_merges FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Only admins can delete" ON public.ui_ki_padhai_content FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Only admins can delete" ON public.user_enrollments FOR DELETE TO authenticated USING (is_admin());

-- 4. Disable GraphQL introspection for anon
REVOKE ALL ON SCHEMA graphql_public FROM anon;

NOTIFY pgrst, 'reload schema';
