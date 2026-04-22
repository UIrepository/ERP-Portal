-- Fix: Teachers blocked from adding a class from the Teacher Schedule page.
-- The only INSERT policies on schedules were for admins/managers/super_admins.
-- Allow teachers to INSERT a schedule row for any (batch, subject) they could
-- modify — i.e. a pair they're directly assigned to, or one reachable via the
-- active subject_merges graph. Reuses teacher_can_modify_schedule so the
-- INSERT and UPDATE authorization stay aligned.

CREATE POLICY "Teachers can insert assigned schedules"
ON public.schedules
FOR INSERT
TO authenticated
WITH CHECK (public.teacher_can_modify_schedule(schedules.batch, schedules.subject));
