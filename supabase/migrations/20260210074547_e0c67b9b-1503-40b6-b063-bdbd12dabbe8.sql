
-- =============================================
-- Update all 4 functions to use Vault lookup
-- and standardize sender email
-- =============================================

-- 1. notify_via_google_group
CREATE OR REPLACE FUNCTION public.notify_via_google_group()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_batch TEXT;
  v_subject TEXT;
  v_email_subject TEXT;
  v_email_html TEXT;
  v_group_email TEXT;
  v_resend_key TEXT;
  v_sender TEXT := 'Unknown IITians <notifications@hq.unknowniitians.com>';
  rec RECORD;
BEGIN
  -- Fetch API key from Vault
  SELECT decrypted_secret INTO v_resend_key FROM vault.decrypted_secrets WHERE name = 'RESEND_API_KEY' LIMIT 1;
  IF v_resend_key IS NULL THEN
    RAISE WARNING 'RESEND_API_KEY not found in vault. Skipping email.';
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'notifications' THEN
    v_batch := NEW.target_batch;
    v_subject := NEW.target_subject;
    v_email_subject := '📢 ' || NEW.title;
    v_email_html := '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">'
      || '<div style="background:#111827;padding:20px 24px;">'
      || '<h1 style="color:#ffffff;margin:0;font-size:18px;font-weight:600;">Unknown IITians</h1>'
      || '</div>'
      || '<div style="padding:24px;background:#ffffff;">'
      || '<h2 style="color:#111827;margin:0 0 12px;font-size:20px;font-weight:700;">' || NEW.title || '</h2>'
      || '<div style="height:1px;background:#e5e7eb;margin:16px 0;"></div>'
      || '<p style="color:#4b5563;line-height:1.7;font-size:15px;margin:0;white-space:pre-wrap;">' || replace(NEW.message, E'\n', '<br/>') || '</p>'
      || '</div>'
      || '<div style="padding:14px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">'
      || '<span style="color:#9ca3af;font-size:12px;">Posted by ' || COALESCE(NEW.created_by_name, 'Admin') || '</span>'
      || '</div></div>';

    IF v_batch IS NULL OR v_batch = 'All Batches' THEN
      FOR rec IN SELECT gg.group_email FROM public.google_groups gg WHERE gg.subject_name IS NULL AND gg.is_active = true
      LOOP
        PERFORM net.http_post(
          url := 'https://api.resend.com/emails',
          headers := jsonb_build_object('Authorization', 'Bearer ' || v_resend_key, 'Content-Type', 'application/json'),
          body := jsonb_build_object('from', v_sender, 'to', array[rec.group_email], 'subject', v_email_subject, 'html', v_email_html)
        );
      END LOOP;
    ELSE
      SELECT gg.group_email INTO v_group_email FROM public.google_groups gg WHERE gg.batch_name = v_batch AND gg.subject_name IS NULL AND gg.is_active = true LIMIT 1;
      IF v_group_email IS NOT NULL THEN
        PERFORM net.http_post(
          url := 'https://api.resend.com/emails',
          headers := jsonb_build_object('Authorization', 'Bearer ' || v_resend_key, 'Content-Type', 'application/json'),
          body := jsonb_build_object('from', v_sender, 'to', array[v_group_email], 'subject', v_email_subject, 'html', v_email_html)
        );
      END IF;
    END IF;

  ELSIF TG_TABLE_NAME = 'recordings' THEN
    v_batch := NEW.batch;
    v_subject := NEW.subject;
    v_email_subject := '🎥 New Lecture: ' || NEW.topic || ' (' || NEW.subject || ')';
    v_email_html := '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">'
      || '<div style="background:#111827;padding:20px 24px;"><h1 style="color:#ffffff;margin:0;font-size:18px;font-weight:600;">Unknown IITians</h1></div>'
      || '<div style="padding:24px;background:#ffffff;">'
      || '<h2 style="color:#111827;margin:0 0 16px;font-size:20px;font-weight:700;">📹 New Recording Available</h2>'
      || '<table style="width:100%;border-collapse:collapse;">'
      || '<tr><td style="padding:10px 0;color:#6b7280;font-size:14px;width:100px;">Subject</td><td style="padding:10px 0;color:#111827;font-size:14px;font-weight:600;">' || NEW.subject || '</td></tr>'
      || '<tr><td style="padding:10px 0;color:#6b7280;font-size:14px;">Topic</td><td style="padding:10px 0;color:#111827;font-size:14px;font-weight:600;">' || NEW.topic || '</td></tr>'
      || '<tr><td style="padding:10px 0;color:#6b7280;font-size:14px;">Date</td><td style="padding:10px 0;color:#111827;font-size:14px;">' || NEW.date || '</td></tr>'
      || '</table></div>'
      || '<div style="padding:14px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;"><span style="color:#9ca3af;font-size:12px;">Unknown IITians Portal</span></div></div>';

    SELECT gg.group_email INTO v_group_email FROM public.google_groups gg WHERE gg.batch_name = v_batch AND gg.subject_name = v_subject AND gg.is_active = true LIMIT 1;
    IF v_group_email IS NOT NULL THEN
      PERFORM net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_resend_key, 'Content-Type', 'application/json'),
        body := jsonb_build_object('from', v_sender, 'to', array[v_group_email], 'subject', v_email_subject, 'html', v_email_html)
      );
    END IF;

  ELSIF TG_TABLE_NAME = 'schedules' THEN
    IF OLD.start_time = NEW.start_time AND OLD.end_time = NEW.end_time AND OLD.day_of_week = NEW.day_of_week AND OLD.date IS NOT DISTINCT FROM NEW.date THEN
      RETURN NEW;
    END IF;
    v_batch := NEW.batch;
    v_subject := NEW.subject;
    v_email_subject := '📅 Schedule Update: ' || NEW.subject || ' (' || NEW.batch || ')';
    v_email_html := '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">'
      || '<div style="background:#111827;padding:20px 24px;"><h1 style="color:#ffffff;margin:0;font-size:18px;font-weight:600;">Unknown IITians</h1></div>'
      || '<div style="padding:24px;background:#ffffff;">'
      || '<h2 style="color:#111827;margin:0 0 16px;font-size:20px;font-weight:700;">📅 Schedule Updated</h2>'
      || '<table style="width:100%;border-collapse:collapse;">'
      || '<tr><td style="padding:10px 0;color:#6b7280;font-size:14px;width:100px;">Subject</td><td style="padding:10px 0;color:#111827;font-size:14px;font-weight:600;">' || NEW.subject || '</td></tr>'
      || '<tr><td style="padding:10px 0;color:#6b7280;font-size:14px;">Batch</td><td style="padding:10px 0;color:#111827;font-size:14px;">' || NEW.batch || '</td></tr>'
      || '<tr><td style="padding:10px 0;color:#6b7280;font-size:14px;">Time</td><td style="padding:10px 0;color:#111827;font-size:14px;">' || NEW.start_time || ' – ' || NEW.end_time || '</td></tr>'
      || CASE WHEN NEW.date IS NOT NULL THEN '<tr><td style="padding:10px 0;color:#6b7280;font-size:14px;">Date</td><td style="padding:10px 0;color:#111827;font-size:14px;">' || NEW.date::text || '</td></tr>' ELSE '' END
      || '</table></div>'
      || '<div style="padding:14px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;"><span style="color:#9ca3af;font-size:12px;">Unknown IITians Portal</span></div></div>';

    SELECT gg.group_email INTO v_group_email FROM public.google_groups gg WHERE gg.batch_name = v_batch AND gg.subject_name IS NULL AND gg.is_active = true LIMIT 1;
    IF v_group_email IS NOT NULL THEN
      PERFORM net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_resend_key, 'Content-Type', 'application/json'),
        body := jsonb_build_object('from', v_sender, 'to', array[v_group_email], 'subject', v_email_subject, 'html', v_email_html)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. handle_email_notification
CREATE OR REPLACE FUNCTION public.handle_email_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  recipient_emails text[];
  email_chunk text[];
  start_idx int;
  end_idx int;
  total_emails int;
  
  resend_api_key text;
  sender_email text := 'Unknown IITians <notifications@hq.unknowniitians.com>';
  
  email_subject text;
  email_html text;
  target_b text;
  target_s text;
BEGIN
  -- Fetch API key from Vault
  SELECT decrypted_secret INTO resend_api_key FROM vault.decrypted_secrets WHERE name = 'RESEND_API_KEY' LIMIT 1;
  IF resend_api_key IS NULL THEN
    RAISE WARNING 'RESEND_API_KEY not found in vault. Skipping email.';
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'notifications' THEN
     target_b := NEW.target_batch;
     target_s := NEW.target_subject;
     email_subject := '📢 ' || NEW.title;
     email_html := '<div style="font-family:sans-serif;"><h2>' || NEW.title || '</h2><hr/><p>' || replace(NEW.message, E'\n', '<br/>') || '</p><p style="color:#888;font-size:12px;">Sent by Unknown IITians</p></div>';
  ELSIF TG_TABLE_NAME = 'recordings' THEN
     target_b := NEW.batch;
     target_s := NEW.subject;
     email_subject := '🎥 New Lecture: ' || NEW.subject;
     email_html := '<div style="font-family:sans-serif;"><h2>New Recording Uploaded</h2><p><strong>Topic:</strong> ' || NEW.topic || '</p><p><a href="' || NEW.embed_link || '" style="background:#2563eb;color:white;padding:10px;text-decoration:none;border-radius:4px;">Watch Now</a></p></div>';
  ELSIF TG_TABLE_NAME = 'notes' THEN
     target_b := NEW.batch;
     target_s := NEW.subject;
     email_subject := '📄 New Notes: ' || NEW.subject;
     email_html := '<div style="font-family:sans-serif;"><h2>New Notes Uploaded</h2><p><strong>Title:</strong> ' || NEW.title || '</p><p><a href="' || NEW.file_url || '" style="background:#059669;color:white;padding:10px;text-decoration:none;border-radius:4px;">Download PDF</a></p></div>';
  END IF;

  SELECT array_agg(email) INTO recipient_emails
  FROM public.profiles
  WHERE role = 'student'
  AND (target_b IS NULL OR target_b = 'All Batches' OR target_b = ANY(batch))
  AND (target_s IS NULL OR target_s = 'All Subjects' OR target_s = ANY(subjects))
  AND email IS NOT NULL;

  IF recipient_emails IS NULL THEN RETURN NEW; END IF;

  total_emails := array_length(recipient_emails, 1);
  start_idx := 1;

  WHILE start_idx <= total_emails LOOP
    end_idx := LEAST(start_idx + 44, total_emails);
    email_chunk := recipient_emails[start_idx : end_idx];
    PERFORM net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || resend_api_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object('from', sender_email, 'to', array['delivered@resend.dev'], 'bcc', email_chunk, 'subject', email_subject, 'html', email_html)
    );
    start_idx := start_idx + 45;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 3. handle_general_notifications
CREATE OR REPLACE FUNCTION public.handle_general_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  recipient_emails text[];
  email_chunk text[];
  start_idx int;
  end_idx int;
  total_emails int;
  
  resend_api_key text;
  sender_email text := 'Unknown IITians <notifications@hq.unknowniitians.com>';
  
  email_subject text;
  email_html text;
  target_b text;
  target_s text;
  is_dpp boolean;
BEGIN
  -- Fetch API key from Vault
  SELECT decrypted_secret INTO resend_api_key FROM vault.decrypted_secrets WHERE name = 'RESEND_API_KEY' LIMIT 1;
  IF resend_api_key IS NULL THEN
    RAISE WARNING 'RESEND_API_KEY not found in vault. Skipping email.';
    RETURN NEW;
  END IF;

  INSERT INTO public.debug_logs (message) VALUES ('Trigger started for table: ' || TG_TABLE_NAME);

  IF TG_TABLE_NAME = 'notifications' THEN
     target_b := NEW.target_batch;
     target_s := NEW.target_subject;
     email_subject := '📢 ' || NEW.title;
     email_html := '<div style="font-family:sans-serif;"><h2>' || NEW.title || '</h2><hr/><p>' || replace(NEW.message, E'\n', '<br/>') || '</p></div>';
  ELSIF TG_TABLE_NAME = 'recordings' THEN
     target_b := NEW.batch;
     target_s := NEW.subject;
     email_subject := '🎥 New Lecture: ' || NEW.subject;
     email_html := '<div style="font-family:sans-serif;"><h2>New Recording</h2><p>Topic: ' || NEW.topic || '</p></div>';
  ELSIF TG_TABLE_NAME = 'notes' THEN
     target_b := NEW.batch;
     target_s := NEW.subject;
     is_dpp := (NEW.title ILIKE '%DPP%' OR NEW.filename ILIKE '%DPP%');
     IF is_dpp THEN
        email_subject := '📝 New DPP: ' || NEW.subject;
        email_html := '<div><h2>New DPP</h2></div>';
     ELSE
        email_subject := '📄 New Notes: ' || NEW.subject;
        email_html := '<div><h2>New Notes</h2></div>';
     END IF;
  END IF;

  INSERT INTO public.debug_logs (message) VALUES ('Targeting Batch: ' || COALESCE(target_b, 'NULL') || ', Subject: ' || COALESCE(target_s, 'NULL'));

  SELECT array_agg(email) INTO recipient_emails
  FROM public.profiles
  WHERE role = 'student'
  AND (target_b IS NULL OR target_b = 'All Batches' OR target_b = ANY(batch))
  AND (target_s IS NULL OR target_s = 'All Subjects' OR target_s = ANY(subjects))
  AND email IS NOT NULL;

  IF recipient_emails IS NULL THEN
    INSERT INTO public.debug_logs (message) VALUES ('Result: 0 students found. Exiting.');
    RETURN NEW;
  ELSE
    INSERT INTO public.debug_logs (message) VALUES ('Result: Found ' || array_length(recipient_emails, 1) || ' students.');
  END IF;

  total_emails := array_length(recipient_emails, 1);
  start_idx := 1;

  WHILE start_idx <= total_emails LOOP
    end_idx := LEAST(start_idx + 44, total_emails);
    email_chunk := recipient_emails[start_idx : end_idx];
    INSERT INTO public.debug_logs (message) VALUES ('Sending batch to Resend...');
    PERFORM net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || resend_api_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object('from', sender_email, 'to', array['delivered@resend.dev'], 'bcc', email_chunk, 'subject', email_subject, 'html', email_html)
    );
    start_idx := start_idx + 45;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 4. handle_priority_chat_notification
CREATE OR REPLACE FUNCTION public.handle_priority_chat_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  recipient_emails text[];
  email_chunk text[];
  start_idx int;
  end_idx int;
  total_emails int;
  sender_name text;
  
  resend_api_key text;
  sender_email text := 'Unknown IITians <notifications@hq.unknowniitians.com>';
  
  email_subject text;
  email_html text;
BEGIN
  IF NEW.is_priority IS NOT TRUE THEN RETURN NEW; END IF;

  -- Fetch API key from Vault
  SELECT decrypted_secret INTO resend_api_key FROM vault.decrypted_secrets WHERE name = 'RESEND_API_KEY' LIMIT 1;
  IF resend_api_key IS NULL THEN
    RAISE WARNING 'RESEND_API_KEY not found in vault. Skipping email.';
    RETURN NEW;
  END IF;

  SELECT name INTO sender_name FROM public.profiles WHERE user_id = NEW.user_id;

  email_subject := '💬 Priority Message in ' || NEW.subject;
  email_html := '<div style="font-family:sans-serif;">' ||
                '<h2 style="color:#d97706;">High Priority Message</h2>' ||
                '<p><strong>From:</strong> ' || COALESCE(sender_name, 'Admin') || '</p>' ||
                '<div style="background-color:#fffbeb;padding:15px;border-left:4px solid #d97706;margin:15px 0;">' || 
                replace(NEW.content, E'\n', '<br/>') || 
                '</div>' ||
                '<p style="color:#666;font-size:12px;">Sent via Unknown IITians Portal</p>' ||
                '</div>';

  SELECT array_agg(email) INTO recipient_emails
  FROM public.profiles
  WHERE role = 'student'
  AND (NEW.batch IS NULL OR NEW.batch = 'All Batches' OR NEW.batch = ANY(batch))
  AND (NEW.subject IS NULL OR NEW.subject = 'All Subjects' OR NEW.subject = ANY(subjects))
  AND email IS NOT NULL;

  IF recipient_emails IS NULL THEN RETURN NEW; END IF;

  total_emails := array_length(recipient_emails, 1);
  start_idx := 1;

  WHILE start_idx <= total_emails LOOP
    end_idx := LEAST(start_idx + 44, total_emails);
    email_chunk := recipient_emails[start_idx : end_idx];
    PERFORM net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || resend_api_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object('from', sender_email, 'to', array['delivered@resend.dev'], 'bcc', email_chunk, 'subject', email_subject, 'html', email_html)
    );
    start_idx := start_idx + 45;
  END LOOP;

  RETURN NEW;
END;
$function$;
