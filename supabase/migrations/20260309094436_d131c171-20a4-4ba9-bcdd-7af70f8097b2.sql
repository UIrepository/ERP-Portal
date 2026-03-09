-- Fix infinite recursion in managers RLS policy
DROP POLICY IF EXISTS "Staff can view all managers" ON public.managers;

CREATE POLICY "Staff can view all managers"
  ON public.managers FOR SELECT
  USING (is_admin() OR is_manager());

NOTIFY pgrst, 'reload schema';