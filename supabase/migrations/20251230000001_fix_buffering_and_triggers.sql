-- =============================================
-- 1. CLEANUP OLD TRIGGERS & FUNCTIONS
-- =============================================
DROP TRIGGER IF EXISTS sync_admin_role_trigger ON public.admins;
DROP TRIGGER IF EXISTS sync_manager_role_trigger ON public.managers;
DROP TRIGGER IF EXISTS sync_teacher_role_trigger ON public.teachers;

DROP FUNCTION IF EXISTS public.sync_role_to_profile();

-- =============================================
-- 2. CREATE NON-RECURSIVE TRIGGERS
-- =============================================

-- Function A: Auto-link User ID based on Email (Runs BEFORE save)
-- This avoids the "Update inside Update" infinite loop
CREATE OR REPLACE FUNCTION public.link_user_id_by_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If user_id is missing, try to find it in auth.users
  IF NEW.user_id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT id INTO NEW.user_id
    FROM auth.users
    WHERE email = NEW.email;
  END IF;
  RETURN NEW;
END;
$$;

-- Function B: Sync Admin Role to Profile (Runs AFTER save)
-- Only runs for Admins to give them 'super_admin' status
CREATE OR REPLACE FUNCTION public.sync_admin_role_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET role = 'super_admin'
    WHERE user_id = NEW.user_id
    AND role IS DISTINCT FROM 'super_admin';
  END IF;
  RETURN NEW;
END;
$$;

-- Apply "Link User ID" Trigger to all 3 tables
CREATE TRIGGER link_admin_user_id_trigger
  BEFORE INSERT OR UPDATE ON public.admins
  FOR EACH ROW EXECUTE FUNCTION public.link_user_id_by_email();

CREATE TRIGGER link_manager_user_id_trigger
  BEFORE INSERT OR UPDATE ON public.managers
  FOR EACH ROW EXECUTE FUNCTION public.link_user_id_by_email();

CREATE TRIGGER link_teacher_user_id_trigger
  BEFORE INSERT OR UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.link_user_id_by_email();

-- Apply "Sync Profile Role" Trigger ONLY to Admins
CREATE TRIGGER sync_admin_profile_role_trigger
  AFTER INSERT OR UPDATE ON public.admins
  FOR EACH ROW EXECUTE FUNCTION public.sync_admin_role_to_profile();

-- =============================================
-- 3. ENSURE RLS & ACCESS (Safety Check)
-- =============================================

-- Ensure Helper Function exists (re-declaring to be safe)
CREATE OR REPLACE FUNCTION public.app_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  );
$$;

-- Grant access to available_options (Fixes Dropdown Buffering)
ALTER TABLE public.available_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read available options" ON public.available_options;
CREATE POLICY "Read available options"
ON public.available_options FOR SELECT
TO authenticated
USING (true); -- Everyone can read options (Batches/Subjects)

DROP POLICY IF EXISTS "Admins manage options" ON public.available_options;
CREATE POLICY "Admins manage options"
ON public.available_options FOR ALL
TO authenticated
USING (public.app_is_admin());

-- Re-Apply Staff Policies (Just in case)
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage admins" ON public.admins;
CREATE POLICY "Admins can manage admins" ON public.admins FOR ALL TO authenticated USING (public.app_is_admin());

DROP POLICY IF EXISTS "Admins can manage managers" ON public.managers;
CREATE POLICY "Admins can manage managers" ON public.managers FOR ALL TO authenticated USING (public.app_is_admin());

DROP POLICY IF EXISTS "Admins can manage teachers" ON public.teachers;
CREATE POLICY "Admins can manage teachers" ON public.teachers FOR ALL TO authenticated USING (public.app_is_admin());

-- Allow staff to read their own records
DROP POLICY IF EXISTS "Managers read own" ON public.managers;
CREATE POLICY "Managers read own" ON public.managers FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Teachers read own" ON public.teachers;
CREATE POLICY "Teachers read own" ON public.teachers FOR SELECT TO authenticated USING (user_id = auth.uid());
