-- =============================================
-- ROLE SYNC SYSTEM
-- =============================================

-- 1. Create function to sync role from role tables to profiles
CREATE OR REPLACE FUNCTION public.sync_role_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_target_role user_role;
BEGIN
  -- Determine the target role based on which table triggered this
  IF TG_TABLE_NAME = 'admins' THEN
    v_target_role := 'super_admin';
  ELSIF TG_TABLE_NAME = 'managers' THEN
    v_target_role := 'student'; -- Managers don't have a specific role in the enum, keeping as student for now
  ELSIF TG_TABLE_NAME = 'teachers' THEN
    v_target_role := 'student'; -- Teachers don't have a specific role in the enum
  END IF;

  -- For INSERT or UPDATE operations
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- Try to find the user_id from auth.users if not already set
    IF NEW.user_id IS NULL THEN
      SELECT id INTO v_user_id FROM auth.users WHERE email = NEW.email;
      IF v_user_id IS NOT NULL THEN
        -- Update the role table with the found user_id
        IF TG_TABLE_NAME = 'admins' THEN
          UPDATE public.admins SET user_id = v_user_id WHERE id = NEW.id;
        ELSIF TG_TABLE_NAME = 'managers' THEN
          UPDATE public.managers SET user_id = v_user_id WHERE id = NEW.id;
        ELSIF TG_TABLE_NAME = 'teachers' THEN
          UPDATE public.teachers SET user_id = v_user_id WHERE id = NEW.id;
        END IF;
        NEW.user_id := v_user_id;
      END IF;
    ELSE
      v_user_id := NEW.user_id;
    END IF;

    -- Update the profile role if we have a user_id and it's an admin
    -- (Only admins get their profile role updated since 'super_admin' exists in the enum)
    IF v_user_id IS NOT NULL AND TG_TABLE_NAME = 'admins' THEN
      UPDATE public.profiles 
      SET role = 'super_admin'::user_role
      WHERE user_id = v_user_id;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Create triggers for admins, managers, and teachers tables
DROP TRIGGER IF EXISTS sync_admin_role_trigger ON public.admins;
CREATE TRIGGER sync_admin_role_trigger
  AFTER INSERT OR UPDATE ON public.admins
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_role_to_profile();

DROP TRIGGER IF EXISTS sync_manager_role_trigger ON public.managers;
CREATE TRIGGER sync_manager_role_trigger
  AFTER INSERT OR UPDATE ON public.managers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_role_to_profile();

DROP TRIGGER IF EXISTS sync_teacher_role_trigger ON public.teachers;
CREATE TRIGGER sync_teacher_role_trigger
  AFTER INSERT OR UPDATE ON public.teachers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_role_to_profile();


-- 3. Create the check_user_role_sync RPC function for login-time verification
CREATE OR REPLACE FUNCTION public.check_user_role_sync()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_current_role user_role;
  v_is_admin boolean := false;
  v_is_manager boolean := false;
  v_is_teacher boolean := false;
  v_detected_role text;
  v_admin_id uuid;
  v_manager_id uuid;
  v_teacher_id uuid;
  v_role_updated boolean := false;
BEGIN
  -- Get current user's email and role from profile
  SELECT email, role INTO v_user_email, v_current_role
  FROM public.profiles
  WHERE user_id = v_user_id;

  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'User profile not found'
    );
  END IF;

  -- Check if user exists in role tables (by user_id OR email)
  SELECT id INTO v_admin_id FROM public.admins 
  WHERE user_id = v_user_id OR email = v_user_email
  LIMIT 1;
  v_is_admin := v_admin_id IS NOT NULL;

  SELECT id INTO v_manager_id FROM public.managers 
  WHERE user_id = v_user_id OR email = v_user_email
  LIMIT 1;
  v_is_manager := v_manager_id IS NOT NULL;

  SELECT id INTO v_teacher_id FROM public.teachers 
  WHERE user_id = v_user_id OR email = v_user_email
  LIMIT 1;
  v_is_teacher := v_teacher_id IS NOT NULL;

  -- Update user_id in role tables if it's missing
  IF v_is_admin THEN
    UPDATE public.admins SET user_id = v_user_id 
    WHERE id = v_admin_id AND user_id IS NULL;
  END IF;

  IF v_is_manager THEN
    UPDATE public.managers SET user_id = v_user_id 
    WHERE id = v_manager_id AND user_id IS NULL;
  END IF;

  IF v_is_teacher THEN
    UPDATE public.teachers SET user_id = v_user_id 
    WHERE id = v_teacher_id AND user_id IS NULL;
  END IF;

  -- Determine the highest priority role
  IF v_is_admin THEN
    v_detected_role := 'admin';
    -- Sync profile role to super_admin if they're an admin but profile says otherwise
    IF v_current_role IS DISTINCT FROM 'super_admin'::user_role THEN
      UPDATE public.profiles SET role = 'super_admin'::user_role WHERE user_id = v_user_id;
      v_role_updated := true;
    END IF;
  ELSIF v_is_manager THEN
    v_detected_role := 'manager';
  ELSIF v_is_teacher THEN
    v_detected_role := 'teacher';
  ELSE
    v_detected_role := 'student';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'detected_role', v_detected_role,
    'is_admin', v_is_admin,
    'is_manager', v_is_manager,
    'is_teacher', v_is_teacher,
    'role_updated', v_role_updated,
    'user_id', v_user_id
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_user_role_sync() TO authenticated;