-- Make user_id nullable for pre-populated enrollments
ALTER TABLE user_enrollments 
ALTER COLUMN user_id DROP NOT NULL;

-- Add unique constraint for upsert operations (email + batch + subject)
ALTER TABLE user_enrollments
ADD CONSTRAINT unique_email_batch_subject 
UNIQUE (email, batch_name, subject_name);

-- Drop existing RLS policies on user_enrollments if any
DROP POLICY IF EXISTS "Users can view their enrollments" ON user_enrollments;
DROP POLICY IF EXISTS "Users can view enrollments by email or user_id" ON user_enrollments;

-- Create new RLS policy to allow viewing by email OR user_id
CREATE POLICY "Users can view enrollments by email or user_id"
ON user_enrollments FOR SELECT
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
  OR user_id = auth.uid()
);