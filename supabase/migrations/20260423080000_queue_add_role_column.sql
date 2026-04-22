-- Allow queue rows to specify the Google Group role.
-- Default stays MEMBER so existing use cases are unaffected.
-- OWNER is required for desk@unknowniitians.com on ui-announcements etc.

ALTER TABLE public.group_addition_queue
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'MEMBER'
  CHECK (role IN ('MEMBER','MANAGER','OWNER'));

-- Overload: enqueue with optional role per batch call.
CREATE OR REPLACE FUNCTION public.enqueue_emails_for_group(
  p_emails text[],
  p_group_email text,
  p_role text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin required';
  END IF;

  IF p_role NOT IN ('MEMBER','MANAGER','OWNER') THEN
    RAISE EXCEPTION 'role must be MEMBER, MANAGER, or OWNER';
  END IF;

  WITH ins AS (
    INSERT INTO public.group_addition_queue (email, group_email, role)
    SELECT DISTINCT trim(e), p_group_email, p_role
      FROM unnest(p_emails) AS e
     WHERE trim(e) <> '' AND position('@' in e) > 1
    ON CONFLICT (lower(email), group_email) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM ins;
  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_emails_for_group(text[], text, text) TO authenticated;
