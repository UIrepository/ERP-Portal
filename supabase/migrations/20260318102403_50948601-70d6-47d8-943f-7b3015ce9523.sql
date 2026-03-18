CREATE OR REPLACE FUNCTION public.get_distinct_enrollment_options()
RETURNS TABLE(batch_name text, subject_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT ue.batch_name, ue.subject_name 
  FROM public.user_enrollments ue
  WHERE ue.batch_name IS NOT NULL AND ue.subject_name IS NOT NULL
  ORDER BY ue.batch_name, ue.subject_name;
$$;