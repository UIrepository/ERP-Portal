-- Fix maintenance access for verified users.
-- Previous SELECT policy referenced auth.users via a subquery, which the
-- `authenticated` role cannot read by default. The subquery returned NULL,
-- so even users present in verified_maintenance_users were filtered out
-- and saw the maintenance page.
--
-- This migration:
--   1. Normalizes stored emails to lowercase.
--   2. Rewrites the SELECT policy to use auth.jwt() ->> 'email' (always
--      available, no auth.users grant needed), with case-insensitive
--      comparison.
--   3. Adds a trigger to keep email lowercase on future inserts/updates.

UPDATE public.verified_maintenance_users
SET email = lower(email)
WHERE email <> lower(email);

DROP POLICY IF EXISTS "Authenticated users check own verification"
  ON public.verified_maintenance_users;

CREATE POLICY "Authenticated users check own verification"
  ON public.verified_maintenance_users
  FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    OR EXISTS (
      SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.verified_maintenance_users_lowercase_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.email := lower(NEW.email);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_verified_maintenance_users_lowercase
  ON public.verified_maintenance_users;

CREATE TRIGGER trg_verified_maintenance_users_lowercase
  BEFORE INSERT OR UPDATE ON public.verified_maintenance_users
  FOR EACH ROW EXECUTE FUNCTION public.verified_maintenance_users_lowercase_email();
