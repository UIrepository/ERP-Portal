-- Push on every direct_messages INSERT (support tickets + DMs). The
-- notify-direct-message function routes it: incoming support -> all admins/
-- managers; a staff reply -> the student; other DMs -> the receiver.
create or replace function public.notify_direct_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform net.http_post(
    url := 'https://lcfzfdjeidinenxcucvj.supabase.co/functions/v1/notify-direct-message',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjZnpmZGplaWRpbmVueGN1Y3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MDc5NzQsImV4cCI6MjA2OTE4Mzk3NH0.L2yGpkzUozHalZUxI-z0zAO_97bMBXbW8APNXqMTSH8'
    ),
    body := jsonb_build_object(
      'sender_id', NEW.sender_id,
      'receiver_id', NEW.receiver_id,
      'context', NEW.context,
      'content', NEW.content
    )
  );
  return NEW;
exception when others then
  raise warning 'notify_direct_message failed: %', sqlerrm;
  return NEW;
end;
$$;

drop trigger if exists on_direct_message_notify on public.direct_messages;
create trigger on_direct_message_notify
  after insert on public.direct_messages
  for each row execute function public.notify_direct_message();
