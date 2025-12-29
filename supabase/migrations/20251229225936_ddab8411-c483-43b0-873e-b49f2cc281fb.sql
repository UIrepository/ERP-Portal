-- Drop existing restrictive policies that prevent role checking
DROP POLICY IF EXISTS "Admins can view all admins" ON public.admins;
DROP POLICY IF EXISTS "Only super admin can manage admins" ON public.admins;

-- Create new policies for admins table
-- Allow authenticated users to check if they exist in admins table (for role resolution)
CREATE POLICY "Users can check their own admin status"
ON public.admins
FOR SELECT
USING (
  auth.uid() = user_id 
  OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Allow existing admins to manage all admin records
CREATE POLICY "Admins can manage all admins"
ON public.admins
FOR ALL
USING (is_admin());

-- Update managers table - add policy to allow users to check their own status
DROP POLICY IF EXISTS "Managers can view their own record" ON public.managers;

CREATE POLICY "Users can check their own manager status"
ON public.managers
FOR SELECT
USING (
  auth.uid() = user_id 
  OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Update teachers table - add policy to allow users to check their own status
DROP POLICY IF EXISTS "Teachers can view their own record" ON public.teachers;

CREATE POLICY "Users can check their own teacher status"
ON public.teachers
FOR SELECT
USING (
  auth.uid() = user_id 
  OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
);