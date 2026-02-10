-- Drop overly permissive batch-only policy on schedules
DROP POLICY IF EXISTS "Students can view schedules for their enrolled batches" ON schedules;

-- The existing policy "Students can view schedules for their enrollments" 
-- already checks both batch AND subject via user_enrollments, so it stays.