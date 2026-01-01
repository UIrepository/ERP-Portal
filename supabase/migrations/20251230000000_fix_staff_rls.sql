-- =============================================
-- FIX RLS POLICIES (COLLISION FIX)
-- =============================================

-- 1. Enable RLS on all staff tables
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- 2. Create a UNIQUE helper function to avoid name collisions
-- We name it 'app_is_admin' to ensure it doesn't conflict with existing 'is_admin' functions
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

-- =============================================
-- POLICIES FOR ADMINS TABLE
-- =============================================

DROP POLICY IF EXISTS "Admins can manage admins" ON public.admins;

CREATE POLICY "Admins can manage admins"
ON public.admins
FOR ALL
TO authenticated
USING (public.app_is_admin());

-- =============================================
-- POLICIES FOR MANAGERS TABLE
-- =============================================

DROP POLICY IF EXISTS "Admins can manage managers" ON public.managers;
DROP POLICY IF EXISTS "Managers can view own record" ON public.managers;

CREATE POLICY "Admins can manage managers"
ON public.managers
FOR ALL
TO authenticated
USING (public.app_is_admin());

CREATE POLICY "Managers can view own record"
ON public.managers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- =============================================
-- POLICIES FOR TEACHERS TABLE
-- =============================================

DROP POLICY IF EXISTS "Admins can manage teachers" ON public.teachers;
DROP POLICY IF EXISTS "Teachers can view own record" ON public.teachers;

CREATE POLICY "Admins can manage teachers"
ON public.teachers
FOR ALL
TO authenticated
USING (public.app_is_admin());

CREATE POLICY "Teachers can view own record"
ON public.teachers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
