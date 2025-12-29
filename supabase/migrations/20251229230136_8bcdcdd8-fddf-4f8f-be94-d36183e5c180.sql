-- Create a function to auto-link user_id in role tables when user signs up
CREATE OR REPLACE FUNCTION public.link_user_to_role_tables()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Link user_id in admins table if email matches
  UPDATE public.admins
  SET user_id = NEW.id
  WHERE email = NEW.email AND user_id IS NULL;

  -- Link user_id in managers table if email matches
  UPDATE public.managers
  SET user_id = NEW.id
  WHERE email = NEW.email AND user_id IS NULL;

  -- Link user_id in teachers table if email matches
  UPDATE public.teachers
  SET user_id = NEW.id
  WHERE email = NEW.email AND user_id IS NULL;

  RETURN NEW;
END;
$$;

-- Create trigger to run after user creation
DROP TRIGGER IF EXISTS on_auth_user_created_link_roles ON auth.users;

CREATE TRIGGER on_auth_user_created_link_roles
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_user_to_role_tables();