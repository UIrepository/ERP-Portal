-- Per-student, per-community mute preference for community push notifications.
-- A row present = that student has muted that batch+subject community. Muting
-- only silences PEER (student) messages; messages from staff (admin / manager /
-- teacher) always notify regardless of this (enforced in notify-community-message).
create table if not exists public.community_mutes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  batch text not null,
  subject text not null,
  created_at timestamptz not null default now(),
  unique (user_id, batch, subject)
);

create index if not exists community_mutes_batch_subject_idx
  on public.community_mutes (batch, subject);

alter table public.community_mutes enable row level security;

-- A student manages only their own mute rows.
drop policy if exists "community_mutes own select" on public.community_mutes;
create policy "community_mutes own select" on public.community_mutes
  for select using (auth.uid() = user_id);

drop policy if exists "community_mutes own insert" on public.community_mutes;
create policy "community_mutes own insert" on public.community_mutes
  for insert with check (auth.uid() = user_id);

drop policy if exists "community_mutes own delete" on public.community_mutes;
create policy "community_mutes own delete" on public.community_mutes
  for delete using (auth.uid() = user_id);

grant select, insert, delete on public.community_mutes to authenticated;
