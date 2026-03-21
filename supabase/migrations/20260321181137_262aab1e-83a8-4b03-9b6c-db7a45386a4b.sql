-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to send content email notification via edge function
CREATE OR REPLACE FUNCTION public.notify_content_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  edge_function_url text;
  content_type text;
  payload jsonb;
BEGIN
  -- Determine content type based on source table
  IF TG_TABLE_NAME = 'dpp_content' THEN
    content_type := 'dpp';
  ELSIF TG_TABLE_NAME = 'ui_ki_padhai_content' THEN
    content_type := 'uikipadhai';
  ELSE
    RETURN NEW;
  END IF;

  -- Only send for active content
  IF NEW.is_active IS FALSE OR NEW.is_active IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if batch or subject is null
  IF NEW.batch IS NULL OR NEW.subject IS NULL THEN
    RETURN NEW;
  END IF;

  edge_function_url := 'https://lcfzfdjeidinenxcucvj.supabase.co/functions/v1/send-content-email';

  payload := jsonb_build_object(
    'content_type', content_type,
    'batch', NEW.batch,
    'subject', NEW.subject,
    'title', NEW.title
  );

  -- Fire and forget HTTP request to edge function using pg_net
  PERFORM net.http_post(
    url := edge_function_url,
    body := payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    )
  );

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Log error but don't block the insert
  RAISE WARNING 'notify_content_email failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Trigger on dpp_content insert
DROP TRIGGER IF EXISTS trigger_dpp_content_email ON public.dpp_content;
CREATE TRIGGER trigger_dpp_content_email
  AFTER INSERT ON public.dpp_content
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_content_email();

-- Trigger on ui_ki_padhai_content insert
DROP TRIGGER IF EXISTS trigger_uikipadhai_content_email ON public.ui_ki_padhai_content;
CREATE TRIGGER trigger_uikipadhai_content_email
  AFTER INSERT ON public.ui_ki_padhai_content
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_content_email();
