
-- =============================================
-- 1. GOOGLE GROUPS MAPPING TABLE
-- =============================================
CREATE TABLE public.google_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_name TEXT NOT NULL,
  subject_name TEXT DEFAULT NULL,
  group_email TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_google_groups_batch_subject 
  ON public.google_groups (batch_name, COALESCE(subject_name, '__ALL__'));

ALTER TABLE public.google_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access on google_groups"
  ON public.google_groups FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_google_groups_updated_at
  BEFORE UPDATE ON public.google_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 2. TRIGGER FUNCTION: Send email to Google Group
-- Fires on: notifications, recordings, schedules
-- Sends ONE email to the group → group forwards to all members
-- =============================================
CREATE OR REPLACE FUNCTION public.notify_via_google_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_batch TEXT;
  v_subject TEXT;
  v_email_subject TEXT;
  v_email_html TEXT;
  v_group_email TEXT;
  v_resend_key TEXT := 're_NohT67im_HpFr5YRibxVqYBoGkdG85DSN';
  v_sender TEXT := 'Unknown IITians <notifications@hq.unknowniitians.com>';
  rec RECORD;
BEGIN

  -- ========== ANNOUNCEMENTS ==========
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
      FOR rec IN 
        SELECT gg.group_email FROM public.google_groups gg 
        WHERE gg.subject_name IS NULL AND gg.is_active = true
      LOOP
        PERFORM net.http_post(
          url := 'https://api.resend.com/emails',
          headers := jsonb_build_object('Authorization', 'Bearer ' || v_resend_key, 'Content-Type', 'application/json'),
          body := jsonb_build_object('from', v_sender, 'to', array[rec.group_email], 'subject', v_email_subject, 'html', v_email_html)
        );
      END LOOP;
    ELSE
      SELECT gg.group_email INTO v_group_email 
      FROM public.google_groups gg 
      WHERE gg.batch_name = v_batch AND gg.subject_name IS NULL AND gg.is_active = true
      LIMIT 1;

      IF v_group_email IS NOT NULL THEN
        PERFORM net.http_post(
          url := 'https://api.resend.com/emails',
          headers := jsonb_build_object('Authorization', 'Bearer ' || v_resend_key, 'Content-Type', 'application/json'),
          body := jsonb_build_object('from', v_sender, 'to', array[v_group_email], 'subject', v_email_subject, 'html', v_email_html)
        );
      END IF;
    END IF;

  -- ========== RECORDINGS ==========
  ELSIF TG_TABLE_NAME = 'recordings' THEN
    v_batch := NEW.batch;
    v_subject := NEW.subject;
    
    v_email_subject := '🎥 New Lecture: ' || NEW.topic || ' (' || NEW.subject || ')';
    v_email_html := '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">'
      || '<div style="background:#111827;padding:20px 24px;">'
      || '<h1 style="color:#ffffff;margin:0;font-size:18px;font-weight:600;">Unknown IITians</h1>'
      || '</div>'
      || '<div style="padding:24px;background:#ffffff;">'
      || '<h2 style="color:#111827;margin:0 0 16px;font-size:20px;font-weight:700;">📹 New Recording Available</h2>'
      || '<table style="width:100%;border-collapse:collapse;">'
      || '<tr><td style="padding:10px 0;color:#6b7280;font-size:14px;width:100px;">Subject</td><td style="padding:10px 0;color:#111827;font-size:14px;font-weight:600;">' || NEW.subject || '</td></tr>'
      || '<tr><td style="padding:10px 0;color:#6b7280;font-size:14px;">Topic</td><td style="padding:10px 0;color:#111827;font-size:14px;font-weight:600;">' || NEW.topic || '</td></tr>'
      || '<tr><td style="padding:10px 0;color:#6b7280;font-size:14px;">Date</td><td style="padding:10px 0;color:#111827;font-size:14px;">' || NEW.date || '</td></tr>'
      || '</table>'
      || '</div>'
      || '<div style="padding:14px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">'
      || '<span style="color:#9ca3af;font-size:12px;">Unknown IITians Portal</span>'
      || '</div></div>';

    SELECT gg.group_email INTO v_group_email 
    FROM public.google_groups gg 
    WHERE gg.batch_name = v_batch AND gg.subject_name = v_subject AND gg.is_active = true
    LIMIT 1;

    IF v_group_email IS NOT NULL THEN
      PERFORM net.http_post(
        url := 'https://api.resend.com/emails',
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_resend_key, 'Content-Type', 'application/json'),
        body := jsonb_build_object('from', v_sender, 'to', array[v_group_email], 'subject', v_email_subject, 'html', v_email_html)
      );
    END IF;

  -- ========== SCHEDULE CHANGES ==========
  ELSIF TG_TABLE_NAME = 'schedules' THEN
    IF OLD.start_time = NEW.start_time 
      AND OLD.end_time = NEW.end_time 
      AND OLD.day_of_week = NEW.day_of_week
      AND OLD.date IS NOT DISTINCT FROM NEW.date THEN
      RETURN NEW;
    END IF;

    v_batch := NEW.batch;
    v_subject := NEW.subject;
    
    v_email_subject := '📅 Schedule Update: ' || NEW.subject || ' (' || NEW.batch || ')';
    v_email_html := '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">'
      || '<div style="background:#111827;padding:20px 24px;">'
      || '<h1 style="color:#ffffff;margin:0;font-size:18px;font-weight:600;">Unknown IITians</h1>'
      || '</div>'
      || '<div style="padding:24px;background:#ffffff;">'
      || '<h2 style="color:#111827;margin:0 0 16px;font-size:20px;font-weight:700;">📅 Schedule Updated</h2>'
      || '<table style="width:100%;border-collapse:collapse;">'
      || '<tr><td style="padding:10px 0;color:#6b7280;font-size:14px;width:100px;">Subject</td><td style="padding:10px 0;color:#111827;font-size:14px;font-weight:600;">' || NEW.subject || '</td></tr>'
      || '<tr><td style="padding:10px 0;color:#6b7280;font-size:14px;">Batch</td><td style="padding:10px 0;color:#111827;font-size:14px;">' || NEW.batch || '</td></tr>'
      || '<tr><td style="padding:10px 0;color:#6b7280;font-size:14px;">Time</td><td style="padding:10px 0;color:#111827;font-size:14px;">' || NEW.start_time || ' – ' || NEW.end_time || '</td></tr>'
      || CASE WHEN NEW.date IS NOT NULL THEN '<tr><td style="padding:10px 0;color:#6b7280;font-size:14px;">Date</td><td style="padding:10px 0;color:#111827;font-size:14px;">' || NEW.date::text || '</td></tr>' ELSE '' END
      || '</table>'
      || '</div>'
      || '<div style="padding:14px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">'
      || '<span style="color:#9ca3af;font-size:12px;">Unknown IITians Portal</span>'
      || '</div></div>';

    SELECT gg.group_email INTO v_group_email 
    FROM public.google_groups gg 
    WHERE gg.batch_name = v_batch AND gg.subject_name IS NULL AND gg.is_active = true
    LIMIT 1;

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
$$;

-- =============================================
-- 3. TRIGGER FUNCTION: Auto-add student to Google Groups
-- Calls edge function on new enrollment
-- =============================================
CREATE OR REPLACE FUNCTION public.auto_add_to_google_group()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://lcfzfdjeidinenxcucvj.supabase.co/functions/v1/manage-google-group',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjZnpmZGplaWRpbmVueGN1Y3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MDc5NzQsImV4cCI6MjA2OTE4Mzk3NH0.L2yGpkzUozHalZUxI-z0zAO_97bMBXbW8APNXqMTSH8'
    ),
    body := jsonb_build_object(
      'action', 'add_member',
      'student_email', NEW.email,
      'batch_name', NEW.batch_name,
      'subject_name', NEW.subject_name
    )
  );

  RETURN NEW;
END;
$$;

-- =============================================
-- 4. CREATE TRIGGERS
-- =============================================
CREATE TRIGGER trg_google_group_announcement
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_via_google_group();

CREATE TRIGGER trg_google_group_recording
  AFTER INSERT ON public.recordings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_via_google_group();

CREATE TRIGGER trg_google_group_schedule_change
  AFTER UPDATE ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_via_google_group();

CREATE TRIGGER trg_auto_add_google_group
  AFTER INSERT ON public.user_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_to_google_group();
