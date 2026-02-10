-- Allow teachers to insert messages into the community_messages table
-- Fix: Uses correct column 'user_id' and checks 'teachers' table for role verification

CREATE POLICY "Teachers can insert community messages"
ON "public"."community_messages"
FOR INSERT
TO authenticated
WITH CHECK (
  -- Ensure the user is inserting their own message (Corrected column name: user_id)
  auth.uid() = user_id 
  AND 
  (
    -- Verify the user exists in the teachers table
    EXISTS (
      SELECT 1 
      FROM public.teachers 
      WHERE teachers.user_id = auth.uid()
    )
    OR
    -- Fallback: Check profiles if they still have the 'teacher' role text (casting to text to avoid enum errors)
    EXISTS (
      SELECT 1 
      FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role::text = 'teacher'
    )
  )
);
