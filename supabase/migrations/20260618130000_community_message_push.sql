-- Push (no email) to a community's students AND assigned teachers on every new
-- community message, excluding the sender. Fires for student and teacher posts
-- alike. The notify-community-message edge function threads by community tag.
create or replace function public.notify_community_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_sender_name text;
begin
  if NEW.is_deleted is true then
    return NEW;
  end if;

  select name into v_sender_name from public.profiles where user_id = NEW.user_id;

  perform net.http_post(
    url := 'https://lcfzfdjeidinenxcucvj.supabase.co/functions/v1/notify-community-message',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjZnpmZGplaWRpbmVueGN1Y3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MDc5NzQsImV4cCI6MjA2OTE4Mzk3NH0.L2yGpkzUozHalZUxI-z0zAO_97bMBXbW8APNXqMTSH8'
    ),
    body := jsonb_build_object(
      'batch', NEW.batch,
      'subject', NEW.subject,
      'sender_id', NEW.user_id,
      'sender_name', coalesce(v_sender_name, 'New message'),
      'content', NEW.content
    )
  );

  return NEW;
exception when others then
  raise warning 'notify_community_message failed: %', sqlerrm;
  return NEW;
end;
$$;

drop trigger if exists on_community_message_notify on public.community_messages;
create trigger on_community_message_notify
  after insert on public.community_messages
  for each row execute function public.notify_community_message();
