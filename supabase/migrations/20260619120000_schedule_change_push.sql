-- Push students + assigned teachers when a class is RESCHEDULED or CANCELLED.
--
-- Reschedule = an UPDATE that changes the class date / start / end / weekday.
-- The UPDATE trigger's WHEN clause guards against the frequent NON-time writes
-- to this table (stream_key & broadcast_id when a teacher goes live, and
-- reminder_sent_date from the reminder job) so those never spam a notification.
-- Cancel = the schedule row being deleted.
create or replace function public.notify_schedule_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_event   text;
  v_batch   text;
  v_subject text;
  v_date    date;
  v_dow     int;
  v_start   time;
  v_end     time;
begin
  if TG_OP = 'DELETE' then
    v_event := 'cancelled';
    v_batch := OLD.batch; v_subject := OLD.subject; v_date := OLD.date;
    v_dow := OLD.day_of_week; v_start := OLD.start_time; v_end := OLD.end_time;
  else
    v_event := 'rescheduled';
    v_batch := NEW.batch; v_subject := NEW.subject; v_date := NEW.date;
    v_dow := NEW.day_of_week; v_start := NEW.start_time; v_end := NEW.end_time;
  end if;

  perform net.http_post(
    url := 'https://lcfzfdjeidinenxcucvj.supabase.co/functions/v1/notify-schedule-change',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjZnpmZGplaWRpbmVueGN1Y3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MDc5NzQsImV4cCI6MjA2OTE4Mzk3NH0.L2yGpkzUozHalZUxI-z0zAO_97bMBXbW8APNXqMTSH8'
    ),
    body := jsonb_build_object(
      'event', v_event,
      'batch', v_batch,
      'subject', v_subject,
      'date', v_date,
      'day_of_week', v_dow,
      'start_time', v_start,
      'end_time', v_end
    )
  );

  if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
exception when others then
  raise warning 'notify_schedule_change failed: %', sqlerrm;
  if TG_OP = 'DELETE' then return OLD; else return NEW; end if;
end;
$$;

drop trigger if exists on_schedule_rescheduled on public.schedules;
create trigger on_schedule_rescheduled
  after update on public.schedules
  for each row
  when (
    OLD.date        is distinct from NEW.date
    or OLD.start_time  is distinct from NEW.start_time
    or OLD.end_time    is distinct from NEW.end_time
    or OLD.day_of_week is distinct from NEW.day_of_week
  )
  execute function public.notify_schedule_change();

drop trigger if exists on_schedule_cancelled on public.schedules;
create trigger on_schedule_cancelled
  after delete on public.schedules
  for each row execute function public.notify_schedule_change();
