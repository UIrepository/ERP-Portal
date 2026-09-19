-- Keeps content_catalog in step with the real content tables, in real time.
--
-- Every sync function reads ONLY safe columns. embed_link, file_url and link are
-- never referenced here, which is the first of the three guarantees that the
-- catalog cannot carry a playable address.
--
-- A row is dropped from the catalog when its source row is deleted, loses its
-- batch/subject, or (for DPPs) is deactivated.

create or replace function public.sync_catalog_recording()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.content_catalog
     where source_table = 'recordings' and source_id = old.id;
    return old;
  end if;

  if new.batch is null or new.subject is null or coalesce(new.topic, '') = '' then
    delete from public.content_catalog
     where source_table = 'recordings' and source_id = new.id;
    return new;
  end if;

  insert into public.content_catalog
    (source_table, source_id, batch, subject, content_type, title, topic, content_date, is_free_preview, sort_key, updated_at)
  values
    ('recordings', new.id, new.batch, new.subject, 'video', new.topic, new.topic, new.date,
     new.is_free_preview, coalesce(new.date::timestamptz, new.created_at, now()), now())
  on conflict (source_table, source_id) do update set
    batch           = excluded.batch,
    subject         = excluded.subject,
    title           = excluded.title,
    topic           = excluded.topic,
    content_date    = excluded.content_date,
    is_free_preview = excluded.is_free_preview,
    sort_key        = excluded.sort_key,
    updated_at      = now();

  return new;
end;
$$;

create or replace function public.sync_catalog_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
begin
  if tg_op = 'DELETE' then
    delete from public.content_catalog
     where source_table = 'notes' and source_id = old.id;
    return old;
  end if;

  v_title := nullif(trim(coalesce(new.title, '')), '');
  v_title := coalesce(v_title, nullif(trim(coalesce(new.filename, '')), ''));

  if new.batch is null or new.subject is null or v_title is null then
    delete from public.content_catalog
     where source_table = 'notes' and source_id = new.id;
    return new;
  end if;

  insert into public.content_catalog
    (source_table, source_id, batch, subject, content_type, title, topic, content_date, is_free_preview, sort_key, updated_at)
  values
    ('notes', new.id, new.batch, new.subject, 'note', v_title, null, new.created_at::date,
     new.is_free_preview, coalesce(new.created_at, now()), now())
  on conflict (source_table, source_id) do update set
    batch           = excluded.batch,
    subject         = excluded.subject,
    title           = excluded.title,
    content_date    = excluded.content_date,
    is_free_preview = excluded.is_free_preview,
    sort_key        = excluded.sort_key,
    updated_at      = now();

  return new;
end;
$$;

create or replace function public.sync_catalog_dpp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.content_catalog
     where source_table = 'dpp_content' and source_id = old.id;
    return old;
  end if;

  if new.batch is null or new.subject is null
     or coalesce(new.title, '') = '' or new.is_active is not true then
    delete from public.content_catalog
     where source_table = 'dpp_content' and source_id = new.id;
    return new;
  end if;

  insert into public.content_catalog
    (source_table, source_id, batch, subject, content_type, title, topic, content_date, is_free_preview, sort_key, updated_at)
  values
    ('dpp_content', new.id, new.batch, new.subject, 'dpp', new.title, new.difficulty, new.created_at::date,
     new.is_free_preview, coalesce(new.created_at, now()), now())
  on conflict (source_table, source_id) do update set
    batch           = excluded.batch,
    subject         = excluded.subject,
    title           = excluded.title,
    topic           = excluded.topic,
    content_date    = excluded.content_date,
    is_free_preview = excluded.is_free_preview,
    sort_key        = excluded.sort_key,
    updated_at      = now();

  return new;
end;
$$;

drop trigger if exists sync_catalog_recording_trg on public.recordings;
create trigger sync_catalog_recording_trg
  after insert or update or delete on public.recordings
  for each row execute function public.sync_catalog_recording();

drop trigger if exists sync_catalog_note_trg on public.notes;
create trigger sync_catalog_note_trg
  after insert or update or delete on public.notes
  for each row execute function public.sync_catalog_note();

drop trigger if exists sync_catalog_dpp_trg on public.dpp_content;
create trigger sync_catalog_dpp_trg
  after insert or update or delete on public.dpp_content
  for each row execute function public.sync_catalog_dpp();

-- Backfill everything that already exists.
insert into public.content_catalog
  (source_table, source_id, batch, subject, content_type, title, topic, content_date, is_free_preview, sort_key)
select 'recordings', r.id, r.batch, r.subject, 'video', r.topic, r.topic, r.date,
       r.is_free_preview, coalesce(r.date::timestamptz, r.created_at, now())
  from public.recordings r
 where r.batch is not null and r.subject is not null and coalesce(r.topic, '') <> ''
on conflict (source_table, source_id) do nothing;

insert into public.content_catalog
  (source_table, source_id, batch, subject, content_type, title, topic, content_date, is_free_preview, sort_key)
select 'notes', n.id, n.batch, n.subject, 'note',
       coalesce(nullif(trim(coalesce(n.title, '')), ''), nullif(trim(coalesce(n.filename, '')), '')),
       null, n.created_at::date, n.is_free_preview, coalesce(n.created_at, now())
  from public.notes n
 where n.batch is not null and n.subject is not null
   and coalesce(nullif(trim(coalesce(n.title, '')), ''), nullif(trim(coalesce(n.filename, '')), '')) is not null
on conflict (source_table, source_id) do nothing;

insert into public.content_catalog
  (source_table, source_id, batch, subject, content_type, title, topic, content_date, is_free_preview, sort_key)
select 'dpp_content', d.id, d.batch, d.subject, 'dpp', d.title, d.difficulty, d.created_at::date,
       d.is_free_preview, coalesce(d.created_at, now())
  from public.dpp_content d
 where d.batch is not null and d.subject is not null
   and coalesce(d.title, '') <> '' and d.is_active is true
on conflict (source_table, source_id) do nothing;
