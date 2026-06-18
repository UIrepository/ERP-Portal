-- The support inbox is meant to be a SHARED team queue, but direct_messages
-- only had a "sender or receiver = me" SELECT policy — so an admin who wasn't
-- personally in a thread (e.g. uiwebsite638) saw NOTHING. Add staff policies so
-- any admin can read + mark-read all support_admin messages, and any manager
-- likewise for support_manager. Personal DMs stay private (existing policies).

create policy "Staff can view support messages"
  on public.direct_messages
  for select
  using (
    (context = 'support_admin' and exists (select 1 from public.admins a where a.user_id = auth.uid()))
    or (context = 'support_manager' and exists (select 1 from public.managers m where m.user_id = auth.uid()))
  );

create policy "Staff can mark support messages read"
  on public.direct_messages
  for update
  using (
    (context = 'support_admin' and exists (select 1 from public.admins a where a.user_id = auth.uid()))
    or (context = 'support_manager' and exists (select 1 from public.managers m where m.user_id = auth.uid()))
  )
  with check (
    (context = 'support_admin' and exists (select 1 from public.admins a where a.user_id = auth.uid()))
    or (context = 'support_manager' and exists (select 1 from public.managers m where m.user_id = auth.uid()))
  );
