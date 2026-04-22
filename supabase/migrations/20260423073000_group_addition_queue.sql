-- Generic queue for bulk-adding members to a Google Group via a worker edge
-- function that drains ~400/run, scheduled by pg_cron. Designed for the
-- 3907-member seed into ui-announcements@unknowniitians.com but kept generic
-- so future bulk ops can reuse it.

CREATE TABLE IF NOT EXISTS public.group_addition_queue (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  group_email  text NOT NULL,
  status       text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','processing','success','skipped','failed')),
  attempts     integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  last_error   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS group_addition_queue_email_group_uq
  ON public.group_addition_queue (lower(email), group_email);

CREATE INDEX IF NOT EXISTS group_addition_queue_status_idx
  ON public.group_addition_queue (status, created_at);

ALTER TABLE public.group_addition_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view queue"
  ON public.group_addition_queue
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can manage queue"
  ON public.group_addition_queue
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Helper: seed the queue with a list of emails for a given group.
-- Ignores duplicates via ON CONFLICT. Returns how many NEW rows were queued.
CREATE OR REPLACE FUNCTION public.enqueue_emails_for_group(
  p_emails text[],
  p_group_email text
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

  WITH ins AS (
    INSERT INTO public.group_addition_queue (email, group_email)
    SELECT DISTINCT trim(e), p_group_email
      FROM unnest(p_emails) AS e
     WHERE trim(e) <> '' AND position('@' in e) > 1
    ON CONFLICT (lower(email), group_email) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO v_inserted FROM ins;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_emails_for_group(text[], text) TO authenticated;

-- Claim N pending rows atomically (SKIP LOCKED prevents double-processing if
-- the cron fires while a previous run is still draining). Returns the claimed
-- rows so the worker can iterate. Worker then UPDATEs each to success/failed.
CREATE OR REPLACE FUNCTION public.claim_group_addition_batch(
  p_limit integer DEFAULT 400
)
RETURNS SETOF public.group_addition_queue
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.group_addition_queue q
     SET status = 'processing',
         attempts = q.attempts + 1
   WHERE q.id IN (
     SELECT id FROM public.group_addition_queue
      WHERE status = 'pending'
         OR (status = 'processing' AND processed_at IS NULL
             AND created_at < now() - interval '15 minutes')  -- release stuck claims
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT p_limit
   )
   RETURNING *;
$$;

REVOKE ALL ON FUNCTION public.claim_group_addition_batch(integer) FROM PUBLIC;
-- only the edge function (via service role) should claim; authenticated users don't need it.
