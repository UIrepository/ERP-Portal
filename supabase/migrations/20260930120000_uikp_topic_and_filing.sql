-- UI Ki Padhai items can sit in a topic too, and DPPs / UI Ki Padhai can be
-- filed from Organise Content by the teachers who teach that subject.
--
-- 1. ui_ki_padhai_content.bucket_id — same shape as recordings / notes /
--    dpp_content. Null = "Other", which is where every existing row starts.
--
-- 2. set_content_topic() — files DPPs or UI Ki Padhai items into a topic.
--    Teachers have no UPDATE rights on those two tables (only admins do), and
--    giving them a general UPDATE policy would also let them rewrite titles and
--    links. This function changes bucket_id and nothing else, and only for
--    items in a (batch, subject) the caller may manage.

alter table public.ui_ki_padhai_content
  add column if not exists bucket_id uuid references public.content_buckets (id) on delete set null;

comment on column public.ui_ki_padhai_content.bucket_id is 'Topic (content_buckets row) this item belongs to. Null = Other.';

create index if not exists ui_ki_padhai_content_bucket_idx
  on public.ui_ki_padhai_content (batch, subject, bucket_id);


create or replace function public.set_content_topic(
  p_kind      text,     -- 'dpp_content' or 'ui_ki_padhai_content'
  p_ids       uuid[],
  p_bucket_id uuid      -- null clears the topic (item goes to "Other")
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pairs   record;
  v_bucket  record;
  v_updated integer;
begin
  if p_kind not in ('dpp_content', 'ui_ki_padhai_content') then
    raise exception 'Unsupported content kind: %', p_kind;
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then
    return 0;
  end if;

  -- Every (batch, subject) the selected items belong to must be one the caller
  -- manages. Admins pass; teachers pass for their own subjects (and merges).
  for v_pairs in execute format(
    'select distinct batch, subject from public.%I where id = any($1)', p_kind
  ) using p_ids loop
    if not (public.is_admin() or public.teacher_can_modify_schedule(v_pairs.batch, v_pairs.subject)) then
      raise exception 'Not allowed to organise % / %', v_pairs.batch, v_pairs.subject;
    end if;

    -- The topic must belong to the same (batch, subject) as the item.
    if p_bucket_id is not null then
      select batch, subject into v_bucket from public.content_buckets where id = p_bucket_id;
      if v_bucket is null then
        raise exception 'Topic not found';
      end if;
      if v_bucket.batch <> v_pairs.batch or v_bucket.subject <> v_pairs.subject then
        raise exception 'That topic belongs to a different batch or subject';
      end if;
    end if;
  end loop;

  execute format('update public.%I set bucket_id = $1 where id = any($2)', p_kind)
    using p_bucket_id, p_ids;
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.set_content_topic(text, uuid[], uuid) from public, anon;
grant execute on function public.set_content_topic(text, uuid[], uuid) to authenticated;

comment on function public.set_content_topic(text, uuid[], uuid) is
  'File DPPs or UI Ki Padhai items into a topic. Changes bucket_id only; caller must manage the subject.';
