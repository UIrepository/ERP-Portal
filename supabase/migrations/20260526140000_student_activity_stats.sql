-- Aggregated activity stats for a student vs their batch.
-- SECURITY DEFINER so it can read across the batch, but it only returns
-- anonymous aggregates (never other students' identities) — and it's cheap:
-- one row instead of shipping every classmate's attendance to the client.
create or replace function public.get_student_activity_stats(p_batch text)
returns table (
  my_classes integer,
  my_minutes integer,
  batch_avg_classes numeric,
  batch_avg_minutes numeric,
  batch_students integer,
  my_rank integer
)
language sql
security definer
set search_path = public
as $$
  with att as (
    select
      user_id,
      count(*)::int as classes,
      coalesce(sum(duration_minutes), 0)::int as minutes
    from class_attendance
    where batch = p_batch
      and coalesce(user_role, 'student') = 'student'
    group by user_id
  ),
  ranked as (
    select user_id, classes, rank() over (order by classes desc) as rnk
    from att
  )
  select
    coalesce((select classes from att where user_id = auth.uid()), 0) as my_classes,
    coalesce((select minutes from att where user_id = auth.uid()), 0) as my_minutes,
    coalesce((select avg(classes) from att), 0) as batch_avg_classes,
    coalesce((select avg(minutes) from att), 0) as batch_avg_minutes,
    coalesce((select count(*) from att), 0)::int as batch_students,
    coalesce((select rnk from ranked where user_id = auth.uid()), 0) as my_rank;
$$;

grant execute on function public.get_student_activity_stats(text) to authenticated;
