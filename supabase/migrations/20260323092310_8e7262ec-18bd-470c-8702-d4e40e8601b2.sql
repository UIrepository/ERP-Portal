
-- Fix cron job: check-class-reminders - replace placeholder with actual anon key
SELECT cron.unschedule('check-class-reminders');
SELECT cron.schedule(
  'check-class-reminders',
  '* * * * *',
  $$
  SELECT net.http_post(
    url:='https://lcfzfdjeidinenxcucvj.supabase.co/functions/v1/send-class-reminders',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjZnpmZGplaWRpbmVueGN1Y3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MDc5NzQsImV4cCI6MjA2OTE4Mzk3NH0.L2yGpkzUozHalZUxI-z0zAO_97bMBXbW8APNXqMTSH8"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);

-- Fix cron job: check-recording-emails - replace placeholder with actual anon key
SELECT cron.unschedule('check-recording-emails');
SELECT cron.schedule(
  'check-recording-emails',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://lcfzfdjeidinenxcucvj.supabase.co/functions/v1/send-recording-emails',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjZnpmZGplaWRpbmVueGN1Y3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MDc5NzQsImV4cCI6MjA2OTE4Mzk3NH0.L2yGpkzUozHalZUxI-z0zAO_97bMBXbW8APNXqMTSH8"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);

-- Clean up stale 401 responses from net._http_response
DELETE FROM net._http_response WHERE status_code = 401;
