-- Allow teachers to delete their own schedule requests (any status).
-- Previously only admins could delete; teachers had no way to remove a
-- request they no longer need, including approved ones.

DROP POLICY IF EXISTS "Teachers can delete their own requests" ON public.schedule_requests;
CREATE POLICY "Teachers can delete their own requests"
  ON public.schedule_requests
  FOR DELETE
  TO authenticated
  USING (
    requested_by IN (
      SELECT teachers.id FROM public.teachers WHERE teachers.user_id = auth.uid()
    )
  );
