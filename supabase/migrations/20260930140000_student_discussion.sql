-- Student Discussion Channel — one public channel for everyone enrolled in the
-- portal (plus staff). Posts, image attachments, nested reply chains,
-- reactions on any post or reply, and @mentions.
--
-- PRIVACY. Nothing here stores or returns an email or any contact detail.
--   * A post only carries author_id. Names come from profile_basics, which is
--     now (user_id, name, avatar_url) only and read-only.
--   * A mention is written in the body as  @[Display Name](user_id)  and is
--     resolved server-side; no lookup path returns anything but name + id.
--   * author_id is always forced to the caller (auth.uid()), so nobody can
--     post as someone else.

-- ── Who may use the channel ─────────────────────────────────────────────────
create or replace function public.can_use_discussion()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
       exists (select 1 from public.user_enrollments where user_id = auth.uid())
    or exists (select 1 from public.admins   where user_id = auth.uid())
    or exists (select 1 from public.managers where user_id = auth.uid())
    or exists (select 1 from public.teachers where user_id = auth.uid())
  );
$$;

-- ── Posts (top-level posts and replies share one table) ─────────────────────
create table if not exists public.discussion_posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles (user_id) on delete cascade,
  -- null = top-level post; otherwise the post/reply being answered.
  parent_id   uuid references public.discussion_posts (id) on delete cascade,
  -- The top-level post a reply belongs to (null for top-level posts). Set by trigger.
  root_id     uuid references public.discussion_posts (id) on delete cascade,
  body        text not null default '' check (length(body) <= 4000),
  -- Only images we uploaded ourselves (signed Cloudinary upload), never an arbitrary URL.
  image_url   text check (image_url is null or image_url ~ '^https://res\.cloudinary\.com/drrits4mq/'),
  is_deleted  boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint discussion_posts_not_empty check (is_deleted or length(trim(body)) > 0 or image_url is not null)
);

create index if not exists discussion_posts_feed_idx on public.discussion_posts (created_at desc) where parent_id is null;
create index if not exists discussion_posts_root_idx on public.discussion_posts (root_id, created_at);
create index if not exists discussion_posts_author_idx on public.discussion_posts (author_id, created_at desc);

-- ── Reactions (on posts and on replies) ─────────────────────────────────────
create table if not exists public.discussion_reactions (
  post_id    uuid not null references public.discussion_posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (user_id) on delete cascade,
  emoji      text not null check (emoji in ('👍', '❤️', '😂', '😮', '🎉', '🙏')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);

create index if not exists discussion_reactions_post_idx on public.discussion_reactions (post_id);

-- ── Mentions (derived from the body by trigger; clients never write these) ───
create table if not exists public.discussion_mentions (
  post_id           uuid not null references public.discussion_posts (id) on delete cascade,
  mentioned_user_id uuid not null references public.profiles (user_id) on delete cascade,
  primary key (post_id, mentioned_user_id)
);

create index if not exists discussion_mentions_user_idx on public.discussion_mentions (mentioned_user_id);

-- ── Insert guard: author, reply chain, rate limit ───────────────────────────
create or replace function public.discussion_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent record;
  v_recent integer;
begin
  -- Browser inserts always post as the caller. (Server-side tooling with no
  -- end user keeps the author it supplies.)
  if auth.uid() is not null then
    new.author_id := auth.uid();

    select count(*) into v_recent
      from public.discussion_posts
     where author_id = auth.uid()
       and created_at > now() - interval '10 minutes';
    if v_recent >= 30 then
      raise exception 'You are posting too quickly. Please wait a few minutes.';
    end if;
  end if;

  new.body       := trim(coalesce(new.body, ''));
  new.is_deleted := false;
  new.created_at := now();

  if new.parent_id is not null then
    select id, root_id, is_deleted into v_parent
      from public.discussion_posts where id = new.parent_id;
    if not found then
      raise exception 'The message you are replying to no longer exists.';
    end if;
    new.root_id := coalesce(v_parent.root_id, v_parent.id);
  else
    new.root_id := null;
  end if;

  return new;
end;
$$;

drop trigger if exists discussion_posts_before_insert on public.discussion_posts;
create trigger discussion_posts_before_insert
  before insert on public.discussion_posts
  for each row execute function public.discussion_before_insert();

-- ── Mentions: parse  @[Name](uuid)  out of the body ─────────────────────────
create or replace function public.discussion_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.discussion_mentions (post_id, mentioned_user_id)
  select distinct new.id, m.uid
    from (
      select (x[1])::uuid as uid
        from regexp_matches(new.body, '@\[[^\]\n]{1,80}\]\(([0-9a-fA-F-]{36})\)', 'g') as x
    ) m
   where m.uid <> new.author_id
     and exists (select 1 from public.profiles p where p.user_id = m.uid)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists discussion_posts_after_insert on public.discussion_posts;
create trigger discussion_posts_after_insert
  after insert on public.discussion_posts
  for each row execute function public.discussion_after_insert();

-- ── Delete (soft): the author, or an admin/manager moderating ────────────────
-- Replies stay in place, so a chain never breaks; the post shows as deleted.
create or replace function public.delete_discussion_post(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.discussion_posts
     set is_deleted = true, body = '', image_url = null
   where id = p_id
     and (author_id = auth.uid() or public.is_admin() or public.is_manager());
  if not found then
    raise exception 'You can only delete your own messages.';
  end if;
  delete from public.discussion_mentions where post_id = p_id;
end;
$$;

revoke all on function public.delete_discussion_post(uuid) from public, anon;
grant execute on function public.delete_discussion_post(uuid) to authenticated;
revoke all on function public.can_use_discussion() from public, anon;
grant execute on function public.can_use_discussion() to authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.discussion_posts     enable row level security;
alter table public.discussion_reactions enable row level security;
alter table public.discussion_mentions  enable row level security;

drop policy if exists "Members read discussion" on public.discussion_posts;
create policy "Members read discussion" on public.discussion_posts
  for select to authenticated using (public.can_use_discussion());

drop policy if exists "Members post to discussion" on public.discussion_posts;
create policy "Members post to discussion" on public.discussion_posts
  for insert to authenticated with check (public.can_use_discussion() and author_id = auth.uid());

-- No UPDATE/DELETE policies: posts are immutable from the browser; deletes go
-- through delete_discussion_post().

drop policy if exists "Members read reactions" on public.discussion_reactions;
create policy "Members read reactions" on public.discussion_reactions
  for select to authenticated using (public.can_use_discussion());

drop policy if exists "Members react" on public.discussion_reactions;
create policy "Members react" on public.discussion_reactions
  for insert to authenticated with check (public.can_use_discussion() and user_id = auth.uid());

drop policy if exists "Members remove own reaction" on public.discussion_reactions;
create policy "Members remove own reaction" on public.discussion_reactions
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "Members read mentions" on public.discussion_mentions;
create policy "Members read mentions" on public.discussion_mentions
  for select to authenticated using (public.can_use_discussion());

revoke all on public.discussion_posts, public.discussion_reactions, public.discussion_mentions from anon;
grant select, insert on public.discussion_posts to authenticated;
grant select, insert, delete on public.discussion_reactions to authenticated;
grant select on public.discussion_mentions to authenticated;

-- New posts appear live for people on the channel (RLS still applies).
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'discussion_posts') then
    alter publication supabase_realtime add table public.discussion_posts;
  end if;
end $$;
