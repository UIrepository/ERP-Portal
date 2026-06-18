-- The video_progress UPDATE policy had a USING clause but no WITH CHECK, so a
-- user could update their own row and reassign user_id to someone else. Add the
-- WITH CHECK and scope to authenticated.
drop policy if exists "Users can update their own video progress" on public.video_progress;
create policy "Users can update their own video progress"
  on public.video_progress for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
