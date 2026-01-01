-- =============================================
-- SWITCH TO DIRECT TABLE AUTH (NO PROFILES.ROLE)
-- =============================================

-- 1. Redefine 'app_is_admin' to check the 'admins' table DIRECTLY
-- This is the key change. We no longer care what is in 'profiles.role'.
CREATE OR REPLACE FUNCTION public.app_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins
    WHERE user_id = auth.uid()
  );
$$;

-- 2. Clean up the old "Sync" triggers (they are now obsolete)
DROP TRIGGER IF EXISTS sync_admin_profile_role_trigger ON public.admins;
DROP FUNCTION IF EXISTS public.sync_admin_role_to_profile();

-- 3. Rewrite the Login Helper (RPC) to be Read-Only
-- The frontend calls this to know "Who am I?". We check the tables directly.
CREATE OR REPLACE FUNCTION public.check_user_role_sync()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_is_admin boolean := false;
  v_is_manager boolean := false;
  v_is_teacher boolean := false;
  v_detected_role text;
BEGIN
  -- Get email from auth.users (reliable source)
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- 1. Check ADMINS table (User ID or Email)
  SELECT EXISTS (
    SELECT 1 FROM public.admins 
    WHERE user_id = v_user_id OR email = v_user_email
  ) INTO v_is_admin;

  -- 2. Check MANAGERS table
  SELECT EXISTS (
    SELECT 1 FROM public.managers 
    WHERE user_id = v_user_id OR email = v_user_email
  ) INTO v_is_manager;

  -- 3. Check TEACHERS table
  SELECT EXISTS (
    SELECT 1 FROM public.teachers 
    WHERE user_id = v_user_id OR email = v_user_email
  ) INTO v_is_teacher;

  -- 4. Auto-Link User ID if it was missing (Self-Healing)
  -- If we found them by email but user_id was NULL, fix it now.
  IF v_is_admin THEN
    UPDATE public.admins SET user_id = v_user_id WHERE email = v_user_email AND user_id IS NULL;
  END IF;
  IF v_is_manager THEN
    UPDATE public.managers SET user_id = v_user_id WHERE email = v_user_email AND user_id IS NULL;
  END IF;
  IF v_is_teacher THEN
    UPDATE public.teachers SET user_id = v_user_id WHERE email = v_user_email AND user_id IS NULL;
  END IF;

  -- 5. Determine Role Priority
  IF v_is_admin THEN
    v_detected_role := 'admin';
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
    'is_teacher', v_is_teacher
  );
END;
$$;

-- 4. Re-Apply RLS Policies with the new 'app_is_admin' logic
-- (This ensures the "Read" buffering issue is fixed because app_is_admin() now works correctly)

-- ADMINS TABLE
DROP POLICY IF EXISTS "Admins can manage admins" ON public.admins;
CREATE POLICY "Admins can manage admins" ON public.admins FOR ALL TO authenticated USING (public.app_is_admin());

-- MANAGERS TABLE
DROP POLICY IF EXISTS "Admins can manage managers" ON public.managers;
DROP POLICY IF EXISTS "Managers can view own record" ON public.managers;

CREATE POLICY "Admins can manage managers" ON public.managers FOR ALL TO authenticated USING (public.app_is_admin());
CREATE POLICY "Managers can view own record" ON public.managers FOR SELECT TO authenticated USING (user_id = auth.uid());

-- TEACHERS TABLE
DROP POLICY IF EXISTS "Admins can manage teachers" ON public.teachers;
DROP POLICY IF EXISTS "Teachers can view own record" ON public.teachers;

CREATE POLICY "Admins can manage teachers" ON public.teachers FOR ALL TO authenticated USING (public.app_is_admin());
CREATE POLICY "Teachers can view own record" ON public.teachers FOR SELECT TO authenticated USING (user_id = auth.uid());

-- AVAILABLE OPTIONS (The buffering cause)
DROP POLICY IF EXISTS "Admins manage options" ON public.available_options;
CREATE POLICY "Admins manage options" ON public.available_options FOR ALL TO authenticated USING (public.app_is_admin());
