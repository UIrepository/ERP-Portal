-- Replace the trigger function to call Resend directly (matching existing pattern)
CREATE OR REPLACE FUNCTION public.notify_content_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_resend_key TEXT;
  v_group_email TEXT;
  v_sender TEXT := 'Unknown IITians <notifications@hq.unknowniitians.com>';
  v_content_label TEXT;
  v_content_short TEXT;
  v_email_subject TEXT;
  v_email_text TEXT;
BEGIN
  -- Only send for active content
  IF NEW.is_active IS FALSE OR NEW.is_active IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if batch or subject is null
  IF NEW.batch IS NULL OR NEW.subject IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get Resend API key
  SELECT value INTO v_resend_key FROM private.app_secrets WHERE key = 'RESEND_API_KEY' LIMIT 1;
  IF v_resend_key IS NULL THEN
    RAISE WARNING 'RESEND_API_KEY not found. Skipping content email.';
    RETURN NEW;
  END IF;

  -- Determine content type
  IF TG_TABLE_NAME = 'dpp_content' THEN
    v_content_label := 'Daily Practice Problem (DPP)';
    v_content_short := 'DPP';
  ELSIF TG_TABLE_NAME = 'ui_ki_padhai_content' THEN
    v_content_label := 'UI Ki Padhai Resource';
    v_content_short := 'UI Ki Padhai';
  ELSE
    RETURN NEW;
  END IF;

  -- Look up Google Group for this batch + subject
  SELECT gg.group_email INTO v_group_email
  FROM public.google_groups gg
  WHERE gg.batch_name = NEW.batch
    AND gg.subject_name = NEW.subject
    AND gg.is_active = true
  LIMIT 1;

  IF v_group_email IS NULL THEN
    RAISE WARNING 'No Google Group found for batch=% subject=%. Skipping content email.', NEW.batch, NEW.subject;
    RETURN NEW;
  END IF;

  v_email_subject := 'Unknown IITians - New ' || v_content_short || ': ' || NEW.title || ' (' || NEW.subject || ')';
  v_email_text := 'Dear Student,' || chr(10) || chr(10)
    || 'A new ' || v_content_label || ' has been uploaded for your course.' || chr(10) || chr(10)
    || 'Subject: ' || NEW.subject || chr(10)
    || 'Batch: ' || NEW.batch || chr(10)
    || 'Title: ' || NEW.title || chr(10) || chr(10)
    || 'Please check the ' || v_content_short || ' section on your dashboard for details.' || chr(10) || chr(10)
    || 'Regards,' || chr(10)
    || 'Unknown IITians Academic Team';

  -- Send via Resend API directly (same pattern as notify_via_google_group)
  PERFORM net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_resend_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'from', v_sender,
      'to', array[v_group_email],
      'subject', v_email_subject,
      'text', v_email_text
    )
  );

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_content_email failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
