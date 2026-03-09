-- Fix infinite recursion in teachers RLS policy
DROP POLICY IF EXISTS "Staff can view all teachers" ON public.teachers;

CREATE POLICY "Staff can view all teachers"
  ON public.teachers FOR SELECT
  USING (is_admin() OR is_manager() OR is_teacher());

NOTIFY pgrst, 'reload schema';