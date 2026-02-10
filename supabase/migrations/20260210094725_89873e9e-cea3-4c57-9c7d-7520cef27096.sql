CREATE POLICY "Students can view all schedules"
ON public.schedules
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role::text = 'student'
  )
);