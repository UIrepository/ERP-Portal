-- =============================================
-- FIX RLS POLICIES FOR STAFF TABLES
-- =============================================

-- 1. Enable RLS on all staff tables to be safe
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- 2. Create a secure helper function to check if current user is an Admin
-- We check the 'profiles' table because the 'admins' table itself is protected by RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER -- Runs with elevated privileges to read profiles safely
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

-- Allow Admins to View, Add, Edit, Delete other admins
DROP POLICY IF EXISTS "Admins can manage admins" ON public.admins;
CREATE POLICY "Admins can manage admins"
ON public.admins
FOR ALL
TO authenticated
USING (public.is_admin());

-- =============================================
-- POLICIES FOR MANAGERS TABLE
-- =============================================

-- Allow Admins to View, Add, Edit, Delete managers
DROP POLICY IF EXISTS "Admins can manage managers" ON public.managers;
CREATE POLICY "Admins can manage managers"
ON public.managers
FOR ALL
TO authenticated
USING (public.is_admin());

-- Allow Managers to view THEIR OWN record (so they can see assigned_batches)
DROP POLICY IF EXISTS "Managers can view own record" ON public.managers;
CREATE POLICY "Managers can view own record"
ON public.managers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- =============================================
-- POLICIES FOR TEACHERS TABLE
-- =============================================

-- Allow Admins to View, Add, Edit, Delete teachers
DROP POLICY IF EXISTS "Admins can manage teachers" ON public.teachers;
CREATE POLICY "Admins can manage teachers"
ON public.teachers
FOR ALL
TO authenticated
USING (public.is_admin());

-- Allow Teachers to view THEIR OWN record (so they can see assigned_subjects)
DROP POLICY IF EXISTS "Teachers can view own record" ON public.teachers;
CREATE POLICY "Teachers can view own record"
ON public.teachers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
