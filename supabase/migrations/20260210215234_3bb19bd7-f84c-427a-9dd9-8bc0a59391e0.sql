
-- A. Add reminder_time and reminder_sent_date to schedules
ALTER TABLE public.schedules 
  ADD COLUMN IF NOT EXISTS reminder_time TIME,
  ADD COLUMN IF NOT EXISTS reminder_sent_date DATE;

-- Backfill reminder_time from start_time - 15 minutes
UPDATE public.schedules SET reminder_time = (start_time - interval '15 minutes')::time WHERE reminder_time IS NULL;

-- Trigger to auto-calculate reminder_time when start_time changes
CREATE OR REPLACE FUNCTION public.auto_set_reminder_time()
RETURNS TRIGGER AS $$
BEGIN
  NEW.reminder_time := (NEW.start_time - interval '15 minutes')::time;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_auto_reminder_time
  BEFORE INSERT OR UPDATE OF start_time ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_reminder_time();

-- B. Add recording_email_sent to recordings
ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS recording_email_sent BOOLEAN DEFAULT false;

-- C. Insert allstudents group into google_groups
INSERT INTO public.google_groups (batch_name, subject_name, group_email, is_active)
VALUES ('__ALL__', NULL, 'allstudents@unknowniitians.com', true)
ON CONFLICT DO NOTHING;

-- D. Drop the recording trigger (recordings now handled by cron)
DROP TRIGGER IF EXISTS trg_google_group_recording ON public.recordings;

-- E. Rewrite notify_via_google_group() -- plain text, no recordings, allstudents for global
CREATE OR REPLACE FUNCTION public.notify_via_google_group()
RETURNS TRIGGER AS $$
DECLARE
  v_batch TEXT;
  v_subject TEXT;
  v_email_subject TEXT;
  v_email_text TEXT;
  v_group_email TEXT;
  v_resend_key TEXT;
  v_sender TEXT := 'Unknown IITians <notifications@hq.unknowniitians.com>';
BEGIN
  SELECT value INTO v_resend_key FROM private.app_secrets WHERE key = 'RESEND_API_KEY' LIMIT 1;
  IF v_resend_key IS NULL THEN
    RAISE WARNING 'RESEND_API_KEY not found. Skipping email.';
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'notifications' THEN
    v_batch := NEW.target_batch;
    v_subject := NEW.target_subject;
    v_email_subject := 'Unknown IITians - Announcement: ' || NEW.title;
    v_email_text := 'Dear Student,' || chr(10) || chr(10)
      || NEW.title || chr(10) || chr(10)
      || NEW.message || chr(10) || chr(10)
      || 'Posted by: ' || COALESCE(NEW.created_by_name, 'Admin') || chr(10) || chr(10)
      || 'Regards,' || chr(10)
      || 'Unknown IITians Academic Team';

    IF (v_batch IS NULL OR v_batch = 'All Batches') AND (v_subject IS NULL OR v_subject = 'All Subjects') THEN
      -- Send to allstudents group
      SELECT gg.group_email INTO v_group_email FROM public.google_groups gg WHERE gg.batch_name = '__ALL__' AND gg.subject_name IS NULL AND gg.is_active = true LIMIT 1;
      IF v_group_email IS NOT NULL THEN
        PERFORM net.http_post(
          url := 'https://api.resend.com/emails',
          headers := jsonb_build_object('Authorization', 'Bearer ' || v_resend_key, 'Content-Type', 'application/json'),
          body := jsonb_build_object('from', v_sender, 'to', array[v_group_email], 'subject', v_email_subject, 'text', v_email_text)
        );
      END IF;
    ELSIF v_batch IS NOT NULL AND v_batch <> 'All Batches' THEN
      -- Send to batch-all group
      SELECT gg.group_email INTO v_group_email FROM public.google_groups gg WHERE gg.batch_name = v_batch AND gg.subject_name IS NULL AND gg.is_active = true LIMIT 1;
      IF v_group_email IS NOT NULL THEN
        PERFORM net.http_post(
          url := 'https://api.resend.com/emails',
          headers := jsonb_build_object('Authorization', 'Bearer ' || v_resend_key, 'Content-Type', 'application/json'),
          body := jsonb_build_object('from', v_sender, 'to', array[v_group_email], 'subject', v_email_subject, 'text', v_email_text)
        );
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'notes' THEN
    v_batch := NEW.batch;
    v_subject := NEW.subject;
    v_email_subject := 'Unknown IITians - New Notes: ' || NEW.title || ' (' || NEW.subject || ')';
    v_email_text := 'Dear Student,' || chr(10) || chr(10)
      || 'New notes have been uploaded for your course.' || chr(10) || chr(10)
      || 'Subject: ' || NEW.subject || chr(10)
      || 'Title: ' || NEW.title || chr(10) || chr(10)
      || 'Please check your dashboard to access the notes.' || chr(10) || chr(10)
      || 'Regards,' || chr(10)
      || 'Unknown IITians Academic Team';

    SELECT gg.group_email INTO v_group_email FROM public.google_groups gg WHERE gg.batch_name = v_batch AND gg.subject_name = v_subject AND gg.is_active = true LIMIT 1;
    IF v_group_email IS NOT NULL THEN
      PERFORM net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_resend_key, 'Content-Type', 'application/json'),
        body := jsonb_build_object('from', v_sender, 'to', array[v_group_email], 'subject', v_email_subject, 'text', v_email_text)
      );
    END IF;

  ELSIF TG_TABLE_NAME = 'schedules' THEN
    IF OLD.start_time = NEW.start_time AND OLD.end_time = NEW.end_time AND OLD.day_of_week = NEW.day_of_week AND OLD.date IS NOT DISTINCT FROM NEW.date THEN
      RETURN NEW;
    END IF;
    v_batch := NEW.batch;
    v_subject := NEW.subject;
    v_email_subject := 'Unknown IITians - Schedule Update: ' || NEW.subject || ' (' || NEW.batch || ')';
    v_email_text := 'Dear Student,' || chr(10) || chr(10)
      || 'The schedule for ' || NEW.subject || ' has been updated.' || chr(10) || chr(10)
      || 'Subject: ' || NEW.subject || chr(10)
      || 'Batch: ' || NEW.batch || chr(10)
      || 'Time: ' || NEW.start_time || ' - ' || NEW.end_time || chr(10)
      || CASE WHEN NEW.date IS NOT NULL THEN 'Date: ' || NEW.date::text || chr(10) ELSE '' END
      || chr(10)
      || 'Please check your dashboard for the latest schedule.' || chr(10) || chr(10)
      || 'Regards,' || chr(10)
      || 'Unknown IITians Academic Team';

    SELECT gg.group_email INTO v_group_email FROM public.google_groups gg WHERE gg.batch_name = v_batch AND gg.subject_name IS NULL AND gg.is_active = true LIMIT 1;
    IF v_group_email IS NOT NULL THEN
      PERFORM net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_resend_key, 'Content-Type', 'application/json'),
        body := jsonb_build_object('from', v_sender, 'to', array[v_group_email], 'subject', v_email_subject, 'text', v_email_text)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- F. Rewrite handle_priority_chat_notification() -- no BCC, use Google Group
CREATE OR REPLACE FUNCTION public.handle_priority_chat_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_group_email TEXT;
  v_resend_key TEXT;
  v_sender TEXT := 'Unknown IITians <notifications@hq.unknowniitians.com>';
  v_sender_name TEXT;
  v_email_subject TEXT;
  v_email_text TEXT;
BEGIN
  IF NEW.is_priority IS NOT TRUE THEN RETURN NEW; END IF;

  SELECT value INTO v_resend_key FROM private.app_secrets WHERE key = 'RESEND_API_KEY' LIMIT 1;
  IF v_resend_key IS NULL THEN
    RAISE WARNING 'RESEND_API_KEY not found. Skipping email.';
    RETURN NEW;
  END IF;

  SELECT name INTO v_sender_name FROM public.profiles WHERE user_id = NEW.user_id;

  -- Look up the subject Google Group
  SELECT gg.group_email INTO v_group_email 
  FROM public.google_groups gg 
  WHERE gg.batch_name = NEW.batch AND gg.subject_name = NEW.subject AND gg.is_active = true 
  LIMIT 1;

  IF v_group_email IS NULL THEN
    RAISE WARNING 'No Google Group found for batch=% subject=%. Skipping.', NEW.batch, NEW.subject;
    RETURN NEW;
  END IF;

  v_email_subject := 'Unknown IITians - Priority Message: ' || NEW.subject;
  v_email_text := 'Dear Student,' || chr(10) || chr(10)
    || 'You have received a priority message in ' || NEW.subject || ' (' || NEW.batch || ').' || chr(10) || chr(10)
    || 'From: ' || COALESCE(v_sender_name, 'Admin') || chr(10) || chr(10)
    || 'Message:' || chr(10)
    || COALESCE(NEW.content, '') || chr(10) || chr(10)
    || 'Please check the community section on your dashboard for details.' || chr(10) || chr(10)
    || 'Regards,' || chr(10)
    || 'Unknown IITians Academic Team';

  PERFORM net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_resend_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object('from', v_sender, 'to', array[v_group_email], 'subject', v_email_subject, 'text', v_email_text)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
