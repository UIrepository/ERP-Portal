-- Create a utility function to backfill user_id for existing users
-- This updates admins, managers, and teachers tables where user_id is NULL
-- but a matching email exists in auth.users
CREATE OR REPLACE FUNCTION public.backfill_role_table_user_ids()
RETURNS TABLE(
  table_name text,
  email text,
  user_id uuid,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update admins table and return affected rows
  RETURN QUERY
  UPDATE public.admins a
  SET user_id = u.id
  FROM auth.users u
  WHERE a.email = u.email AND a.user_id IS NULL
  RETURNING 'admins'::text, a.email, u.id, 'updated'::text;

  -- Update managers table and return affected rows
  RETURN QUERY
  UPDATE public.managers m
  SET user_id = u.id
  FROM auth.users u
  WHERE m.email = u.email AND m.user_id IS NULL
  RETURNING 'managers'::text, m.email, u.id, 'updated'::text;

  -- Update teachers table and return affected rows
  RETURN QUERY
  UPDATE public.teachers t
  SET user_id = u.id
  FROM auth.users u
  WHERE t.email = u.email AND t.user_id IS NULL
  RETURNING 'teachers'::text, t.email, u.id, 'updated'::text;
END;
$$;

-- Grant execute permission to authenticated users (admins can call this)
GRANT EXECUTE ON FUNCTION public.backfill_role_table_user_ids() TO authenticated;