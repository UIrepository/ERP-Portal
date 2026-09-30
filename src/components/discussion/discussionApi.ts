import { supabase } from '@/integrations/supabase/client';

/**
 * Data access for the Student Discussion Channel.
 *
 * PRIVACY: every read goes through profile_basics for the author, which only
 * exposes (user_id, name, avatar_url). Nothing here selects an email, and the
 * mention search returns names only.
 */

export const REACTIONS = ['👍', '❤️', '😂', '😮', '🎉', '🙏'] as const;
export type Reaction = (typeof REACTIONS)[number];

export interface DiscussionPost {
  id: string;
  author_id: string;
  parent_id: string | null;
  root_id: string | null;
  body: string;
  image_url: string | null;
  is_deleted: boolean;
  created_at: string;
  author: { name: string | null } | null;
  discussion_reactions: { emoji: string; user_id: string }[];
}

export interface MentionCandidate {
  user_id: string;
  name: string;
}

/** Explicit FK hint: a post relates to profile_basics both as author and via mentions. */
const POST_COLUMNS =
  'id, author_id, parent_id, root_id, body, image_url, is_deleted, created_at, ' +
  'author:profile_basics!discussion_posts_author_id_fkey(name), ' +
  'discussion_reactions(emoji, user_id)';

// discussion_* tables are newer than the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = (name: string) => supabase.from(name as never) as any;

export const PAGE_SIZE = 15;

/** Top-level posts, newest first — everyone's, or only one author's ("My Posts"). */
export async function fetchFeed(page: number, authorId?: string): Promise<DiscussionPost[]> {
  const from = page * PAGE_SIZE;
  let q = table('discussion_posts').select(POST_COLUMNS).is('parent_id', null);
  if (authorId) q = q.eq('author_id', authorId);
  const { data, error } = await q
    .order('created_at', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (error) throw error;
  return (data ?? []) as DiscussionPost[];
}

/** How many replies each of these top-level posts has. */
export async function fetchReplyCounts(rootIds: string[]): Promise<Record<string, number>> {
  if (!rootIds.length) return {};
  const { data, error } = await table('discussion_posts').select('root_id').in('root_id', rootIds);
  if (error) throw error;
  const out: Record<string, number> = {};
  ((data ?? []) as { root_id: string }[]).forEach((r) => { out[r.root_id] = (out[r.root_id] ?? 0) + 1; });
  return out;
}

/** Every reply under one top-level post, oldest first (the UI builds the tree). */
export async function fetchThread(rootId: string): Promise<DiscussionPost[]> {
  const { data, error } = await table('discussion_posts')
    .select(POST_COLUMNS)
    .eq('root_id', rootId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DiscussionPost[];
}

export async function createPost(input: { body: string; imageUrl?: string | null; parentId?: string | null; authorId: string }) {
  const { error } = await table('discussion_posts').insert({
    body: input.body,
    image_url: input.imageUrl ?? null,
    parent_id: input.parentId ?? null,
    // The server forces this to the signed-in user anyway; it is sent only so
    // the row passes the insert policy check.
    author_id: input.authorId,
  });
  if (error) throw error;
}

export async function deletePost(id: string) {
  const { error } = await supabase.rpc('delete_discussion_post' as never, { p_id: id } as never);
  if (error) throw error;
}

export async function toggleReaction(postId: string, userId: string, emoji: string, on: boolean) {
  if (on) {
    const { error } = await table('discussion_reactions').insert({ post_id: postId, user_id: userId, emoji });
    if (error && error.code !== '23505') throw error; // already reacted — fine
  } else {
    const { error } = await table('discussion_reactions')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
      .eq('emoji', emoji);
    if (error) throw error;
  }
}

/** Name-only people search for @mentions. Never returns an email. */
export async function searchPeople(q: string, excludeId?: string): Promise<MentionCandidate[]> {
  const term = q.trim().replace(/[%_,()]/g, '');
  if (term.length < 2) return [];
  const { data, error } = await supabase
    .from('profile_basics')
    .select('user_id, name')
    .ilike('name', `%${term}%`)
    .not('name', 'is', null)
    .limit(7);
  if (error) throw error;
  return ((data ?? []) as MentionCandidate[]).filter((p) => p.user_id && p.user_id !== excludeId).slice(0, 6);
}

/** A mention is stored in the body as @[Display Name](user_id). */
export const MENTION_RE = /@\[([^\]\n]{1,80})\]\(([0-9a-fA-F-]{36})\)/g;
