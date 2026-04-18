-- 1. Rewrite get_user_role_from_tables to honor the parameter
CREATE OR REPLACE FUNCTION public.get_user_role_from_tables(check_user_id uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  actual_user_id uuid;
BEGIN
  -- Honor the explicit parameter, fall back to auth.uid() only if not provided
  actual_user_id := COALESCE(check_user_id, auth.uid());

  -- If we still have no user id, return NULL so the client can distinguish
  -- "unknown" from "confirmed student"
  IF actual_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM public.admins WHERE user_id = actual_user_id) THEN
    RETURN 'admin';
  END IF;

  IF EXISTS (SELECT 1 FROM public.managers WHERE user_id = actual_user_id) THEN
    RETURN 'manager';
  END IF;

  IF EXISTS (SELECT 1 FROM public.teachers WHERE user_id = actual_user_id) THEN
    RETURN 'teacher';
  END IF;

  RETURN 'student';
END;
$function$;

-- 2. One-time data cleanup: align profiles.role with actual role tables
-- Set teacher role for users in teachers table
UPDATE public.profiles p
SET role = 'teacher'::user_role, updated_at = now()
WHERE EXISTS (SELECT 1 FROM public.teachers t WHERE t.user_id = p.user_id)
  AND p.role IS DISTINCT FROM 'teacher'::user_role;

-- Set manager role for users in managers table
UPDATE public.profiles p
SET role = 'manager'::user_role, updated_at = now()
WHERE EXISTS (SELECT 1 FROM public.managers m WHERE m.user_id = p.user_id)
  AND p.role IS DISTINCT FROM 'manager'::user_role;

-- Set admin role for users in admins table
UPDATE public.profiles p
SET role = 'admin'::user_role, updated_at = now()
WHERE EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = p.user_id)
  AND p.role IS DISTINCT FROM 'admin'::user_role;

-- Reset stale elevated roles for users NOT in any role table
UPDATE public.profiles p
SET role = 'student'::user_role, updated_at = now()
WHERE p.role IN ('admin'::user_role, 'manager'::user_role, 'teacher'::user_role, 'super_admin'::user_role)
  AND NOT EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = p.user_id)
  AND NOT EXISTS (SELECT 1 FROM public.managers m WHERE m.user_id = p.user_id)
  AND NOT EXISTS (SELECT 1 FROM public.teachers t WHERE t.user_id = p.user_id);