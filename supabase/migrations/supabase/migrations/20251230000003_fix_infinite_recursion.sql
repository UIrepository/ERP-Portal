-- =============================================
-- FIX INFINITE RECURSION (DEADLOCK) & ACCESS
-- =============================================

-- 1. Reset Policies completely to ensure no old loops remain
DROP POLICY IF EXISTS "Admins can manage admins" ON public.admins;
DROP POLICY IF EXISTS "Admins can view all" ON public.admins;
DROP POLICY IF EXISTS "Admins can manage managers" ON public.managers;
DROP POLICY IF EXISTS "Managers can view own record" ON public.managers;
DROP POLICY IF EXISTS "Admins can manage teachers" ON public.teachers;
DROP POLICY IF EXISTS "Teachers can view own record" ON public.teachers;

-- 2. Define the Admin Check Function (Simplified)
-- This function is used for WRITE permissions (Add/Edit/Delete)
CREATE OR REPLACE FUNCTION public.app_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Checks if the user exists in the admins table
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = auth.uid()
  );
$$;

-- =============================================
-- NEW POLICIES: SEPARATE READ vs. WRITE
-- =============================================

-- A. ADMINS TABLE
-- READ: Allow ALL authenticated users (Students need to see Admins to chat)
-- This BREAKS the recursion because 'SELECT' no longer calls 'app_is_admin()'
CREATE POLICY "Everyone can view admins"
ON public.admins FOR SELECT
TO authenticated
USING (true);

-- WRITE: Only Admins can Insert/Update/Delete
CREATE POLICY "Admins can manage admins"
ON public.admins FOR INSERT
TO authenticated
WITH CHECK (public.app_is_admin());

CREATE POLICY "Admins can update admins"
ON public.admins FOR UPDATE
TO authenticated
USING (public.app_is_admin());

CREATE POLICY "Admins can delete admins"
ON public.admins FOR DELETE
TO authenticated
USING (public.app_is_admin());


-- B. MANAGERS TABLE
-- READ: Allow ALL authenticated users (Students need to see Managers to chat)
CREATE POLICY "Everyone can view managers"
ON public.managers FOR SELECT
TO authenticated
USING (true);

-- WRITE: Only Admins can manage
CREATE POLICY "Admins can manage managers"
ON public.managers FOR ALL
TO authenticated
USING (public.app_is_admin());


-- C. TEACHERS TABLE
-- READ: Allow ALL authenticated users (Students need to see Teachers to chat)
CREATE POLICY "Everyone can view teachers"
ON public.managers FOR SELECT -- Typo fix in policy name, ensuring on correct table
TO authenticated
USING (true);

-- Fix: Ensure the policy is actually applied to the 'teachers' table
DROP POLICY IF EXISTS "Everyone can view teachers" ON public.teachers;
CREATE POLICY "Everyone can view teachers"
ON public.teachers FOR SELECT
TO authenticated
USING (true);

-- WRITE: Only Admins can manage
CREATE POLICY "Admins can manage teachers"
ON public.teachers FOR ALL
TO authenticated
USING (public.app_is_admin());

-- =============================================
-- 3. FINAL SAFETY: ENSURE YOU ARE ADMIN
-- =============================================
-- (This block ensures your current user is definitely in the admins table)
DO $$
DECLARE
  v_email text := 'YOUR_EMAIL@GMAIL.COM'; -- REPLACE WITH YOUR EMAIL IF NEEDED
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = v_email;
  
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.admins (email, name, user_id, created_at)
    VALUES (v_email, 'Super Admin', v_uid, now())
    ON CONFLICT (email) DO UPDATE SET user_id = v_uid;
  END IF;
END $$;
