-- Web Push subscription storage. The client (src/lib/push.ts) upserts a row
-- per browser/device when the user enables notifications; edge functions read
-- these (via the service role) to deliver Web Push. This table was missing,
-- which silently broke all push delivery.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

-- A user may only see/insert/update/delete their own device subscriptions.
-- (Edge functions use the service role, which bypasses RLS, to read all.)
drop policy if exists "Users manage their own push subscriptions" on public.push_subscriptions;
create policy "Users manage their own push subscriptions"
  on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
