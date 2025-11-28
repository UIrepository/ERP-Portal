-- Drop existing triggers if any
DROP TRIGGER IF EXISTS send_notification_email ON public.notifications;
DROP TRIGGER IF EXISTS send_recording_email ON public.recordings;
DROP TRIGGER IF EXISTS send_note_email ON public.notes;
DROP TRIGGER IF EXISTS send_priority_chat_email ON public.community_messages;

DROP FUNCTION IF EXISTS public.send_personalized_email();

-- Create the main email sending function
CREATE OR REPLACE FUNCTION public.send_personalized_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_email text;
  recipient_name text;
  email_subject text;
  email_html text;
  target_b text;
  target_s text;
  resend_api_key text := 're_NohT67im_HpFr5YRibxVqYBoGkdG85DSN';
  sender_email text := 'Unknown IITians <support@unknowniitians.live>';
  http_response record;
BEGIN
  -- Determine target batch and subject based on trigger table
  IF TG_TABLE_NAME = 'notifications' THEN
    target_b := NEW.target_batch;
    target_s := NEW.target_subject;
    email_subject := '📢 ' || NEW.title;
    email_html := '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#2563eb;">' || NEW.title || '</h2>
      <hr style="border:0;border-top:1px solid #e5e7eb;"/>
      <p style="white-space:pre-wrap;">' || replace(NEW.message, E'\n', '<br/>') || '</p>
      <p style="color:#6b7280;font-size:12px;margin-top:20px;">Sent via Unknown IITians Portal</p>
    </div>';
    
  ELSIF TG_TABLE_NAME = 'recordings' THEN
    target_b := NEW.batch;
    target_s := NEW.subject;
    email_subject := '🎥 New Lecture: ' || NEW.subject || ' - ' || NEW.topic;
    email_html := '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#dc2626;">🎥 New Lecture Recording</h2>
      <p><strong>Subject:</strong> ' || NEW.subject || '</p>
      <p><strong>Topic:</strong> ' || NEW.topic || '</p>
      <p><strong>Date:</strong> ' || NEW.date || '</p>
      <div style="margin-top:20px;">
        <a href="' || NEW.embed_link || '" style="background-color:#dc2626;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">Watch Now</a>
      </div>
      <p style="color:#6b7280;font-size:12px;margin-top:20px;">Sent via Unknown IITians Portal</p>
    </div>';
    
  ELSIF TG_TABLE_NAME = 'notes' THEN
    target_b := NEW.batch;
    target_s := NEW.subject;
    email_subject := '📄 New Study Material: ' || NEW.subject || ' - ' || NEW.title;
    email_html := '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#059669;">📄 New Study Material</h2>
      <p><strong>Subject:</strong> ' || NEW.subject || '</p>
      <p><strong>Title:</strong> ' || NEW.title || '</p>
      <div style="margin-top:20px;">
        <a href="' || NEW.file_url || '" style="background-color:#059669;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;">Download PDF</a>
      </div>
      <p style="color:#6b7280;font-size:12px;margin-top:20px;">Sent via Unknown IITians Portal</p>
    </div>';
    
  ELSIF TG_TABLE_NAME = 'community_messages' AND NEW.is_priority = true THEN
    target_b := NEW.batch;
    target_s := NEW.subject;
    
    -- Get sender name
    SELECT name INTO recipient_name FROM public.profiles WHERE user_id = NEW.user_id;
    
    email_subject := '💬 High Priority Message: ' || NEW.subject;
    email_html := '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#d97706;">💬 High Priority Message</h2>
      <p><strong>From:</strong> ' || COALESCE(recipient_name, 'Admin') || '</p>
      <p><strong>Subject:</strong> ' || NEW.subject || '</p>
      <div style="background-color:#fffbeb;padding:15px;border-left:4px solid #d97706;margin:15px 0;">
        <p style="white-space:pre-wrap;">' || replace(NEW.content, E'\n', '<br/>') || '</p>
      </div>
      <p style="color:#6b7280;font-size:12px;margin-top:20px;">Sent via Unknown IITians Portal</p>
    </div>';
  ELSE
    -- Not a trigger we care about
    RETURN NEW;
  END IF;

  -- Loop through enrolled students and send individual emails
  FOR recipient_email, recipient_name IN
    SELECT p.email, p.name
    FROM public.profiles p
    INNER JOIN public.user_enrollments ue ON ue.user_id = p.user_id
    WHERE p.role = 'student'
      AND p.email IS NOT NULL
      AND (target_b IS NULL OR target_b = 'All Batches' OR ue.batch_name = target_b)
      AND (target_s IS NULL OR target_s = 'All Subjects' OR ue.subject_name = target_s)
    GROUP BY p.email, p.name
  LOOP
    -- Send individual email using pg_net
    SELECT * INTO http_response FROM net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || resend_api_key,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'from', sender_email,
        'to', array[recipient_email],
        'subject', email_subject,
        'html', email_html
      )
    );
    
    -- Log if there's an error (optional, for debugging)
    IF http_response.status_code NOT BETWEEN 200 AND 299 THEN
      RAISE WARNING 'Failed to send email to %: Status %', recipient_email, http_response.status_code;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create triggers for each table
CREATE TRIGGER send_notification_email
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.send_personalized_email();

CREATE TRIGGER send_recording_email
  AFTER INSERT ON public.recordings
  FOR EACH ROW
  EXECUTE FUNCTION public.send_personalized_email();

CREATE TRIGGER send_note_email
  AFTER INSERT ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.send_personalized_email();

CREATE TRIGGER send_priority_chat_email
  AFTER INSERT ON public.community_messages
  FOR EACH ROW
  WHEN (NEW.is_priority = true)
  EXECUTE FUNCTION public.send_personalized_email();