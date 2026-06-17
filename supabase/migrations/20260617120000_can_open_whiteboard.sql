-- Authorization gate for the teaching whiteboard (/whiteboard/:scheduleId).
-- The route previously only required a signed-in user, so any student could open
-- it. A whiteboard for a given schedule should only be openable by the staff in
-- charge of that class: admins / super-admins, managers, or the teacher assigned
-- to that schedule's batch+subject (including merged batches/subjects).
create or replace function public.can_open_whiteboard(p_schedule_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_batch text;
  v_subject text;
begin
  if auth.uid() is null then
    return false;
  end if;

  select batch, subject into v_batch, v_subject
    from schedules
   where id = p_schedule_id;

  -- Unknown schedule -> no access.
  if v_batch is null then
    return false;
  end if;

  -- Admins / super-admins / managers oversee all batches.
  if check_is_admin_or_manager() then
    return true;
  end if;
  if is_admin(auth.uid()) then
    return true;
  end if;

  -- Teacher assigned to this batch+subject (reuses the same merge-aware check
  -- used by the schedules UPDATE RLS policy).
  if teacher_can_modify_schedule(v_batch, v_subject) then
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.can_open_whiteboard(uuid) from public;
grant execute on function public.can_open_whiteboard(uuid) to authenticated;
