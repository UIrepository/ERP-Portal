-- Drop the old, incorrect RLS policies for students
DROP POLICY IF EXISTS "Students can view notes for their batch and subjects" ON public.notes;
DROP POLICY IF EXISTS "Students can view recordings for their batch and subjects" ON public.recordings;
-- The DPP content table (ui_ki_padhai) likely needs a policy as well. This will create one.
DROP POLICY IF EXISTS "Students can view dpp_content for their batch and subjects" ON public.dpp_content;

-- Create new, correct RLS policies that use the 'user_enrollments' table.
-- This ensures students can only see content for which they are explicitly enrolled.

CREATE POLICY "Students can view notes for their enrollments" ON public.notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_enrollments
      WHERE user_enrollments.user_id = auth.uid()
        AND user_enrollments.batch_name = notes.batch
        AND user_enrollments.subject_name = notes.subject
    )
  );

CREATE POLICY "Students can view recordings for their enrollments" ON public.recordings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_enrollments
      WHERE user_enrollments.user_id = auth.uid()
        AND user_enrollments.batch_name = recordings.batch
        AND user_enrollments.subject_name = recordings.subject
    )
  );

CREATE POLICY "Students can view dpp_content for their enrollments" ON public.dpp_content
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_enrollments
      WHERE user_enrollments.user_id = auth.uid()
        AND user_enrollments.batch_name = dpp_content.batch
        AND user_enrollments.subject_name = dpp_content.subject
    )
  );
