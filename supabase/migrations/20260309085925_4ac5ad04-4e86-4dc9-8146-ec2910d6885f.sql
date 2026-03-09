
-- Create security definer function for student admin lookup (for support chat)
CREATE OR REPLACE FUNCTION public.get_admin_for_support()
RETURNS TABLE(user_id uuid, name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT a.user_id, a.name
  FROM public.admins a
  WHERE a.user_id IS NOT NULL
  LIMIT 1;
END;
$$;
