
-- Remove the old cron job with wrong bucket name and 2-day interval
SELECT cron.unschedule('delete_old_chat_uploads_midnight');

-- Create new cron job that runs daily at midnight using the new function
SELECT cron.schedule(
  'cleanup_chat_uploads_7days',
  '0 0 * * *',
  $$SELECT public.delete_old_chat_uploads();$$
);
