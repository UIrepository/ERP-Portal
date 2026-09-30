import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { HugeiconsIcon } from '@hugeicons/react';
import { BubbleChatIcon } from '@hugeicons/core-free-icons';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { DiscussionComposer } from './DiscussionComposer';
import { DiscussionItem } from './DiscussionItem';
import {
  PAGE_SIZE, createPost, fetchFeed, fetchReplyCounts, fetchThread, type DiscussionPost,
} from './discussionApi';

type Tab = 'all' | 'mine';

/** A top-level post plus (when opened) its whole reply tree. */
const ThreadedPost = ({
  post, meId, canModerate, open, replyCount, onToggle, onReplySent, onChanged,
}: {
  post: DiscussionPost;
  meId: string;
  canModerate: boolean;
  open: boolean;
  replyCount: number;
  onToggle: () => void;
  onReplySent: (rootId: string) => void;
  onChanged: () => void;
}) => {
  const { data: replies = [], isLoading } = useQuery({
    queryKey: ['discussion-thread', post.id],
    queryFn: () => fetchThread(post.id),
    enabled: open,
    staleTime: 20_000,
  });

  const byParent = useMemo(() => {
    const m = new Map<string, DiscussionPost[]>();
    replies.forEach((r) => {
      const k = r.parent_id ?? post.id;
      const list = m.get(k);
      if (list) list.push(r); else m.set(k, [r]);
    });
    return m;
  }, [replies, post.id]);

  const toggle = replyCount > 0 && (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-9 items-center gap-1.5 rounded-md px-2 text-[13.5px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    >
      <HugeiconsIcon icon={BubbleChatIcon} size={16} strokeWidth={2} />
      {open ? 'Hide replies' : replyCount === 1 ? 'View 1 reply' : `View all ${replyCount} replies`}
    </button>
  );

  return (
    <DiscussionItem
      post={post}
      meId={meId}
      canModerate={canModerate}
      depth={0}
      childrenOf={open ? (id) => byParent.get(id) ?? [] : undefined}
      onReplySent={onReplySent}
      onChanged={onChanged}
      footerExtra={toggle}
      repliesLoading={open && isLoading}
    />
  );
};

/**
 * General Discussion — one open channel for every student across all batches
 * (separate from the per-batch Community chat).
 * Post, attach an image, react, reply at any depth, react to replies, @tag.
 * Only names are ever shown; see discussionApi for the privacy notes.
 */
export const DiscussionChannel = () => {
  const { user, resolvedRole } = useAuth();
  const meId = user?.id ?? '';
  const canModerate = resolvedRole === 'admin' || resolvedRole === 'manager';
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('all');
  const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());

  const feed = useInfiniteQuery({
    queryKey: ['discussion-feed', tab],
    queryFn: ({ pageParam }) => fetchFeed(pageParam, tab === 'mine' ? meId : undefined),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === PAGE_SIZE ? all.length : undefined),
    enabled: !!meId,
    staleTime: 20_000,
  });

  const posts = feed.data?.pages.flat() ?? [];
  const postIds = posts.map((p) => p.id);

  const { data: replyCounts = {} } = useQuery({
    queryKey: ['discussion-reply-counts', postIds],
    queryFn: () => fetchReplyCounts(postIds),
    enabled: postIds.length > 0,
    staleTime: 20_000,
  });

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ['discussion-feed'] });
    qc.invalidateQueries({ queryKey: ['discussion-reply-counts'] });
    qc.invalidateQueries({ queryKey: ['discussion-thread'] });
  };

  // New posts and replies appear live for everyone on this page.
  useEffect(() => {
    if (!meId) return;
    const ch = supabase
      .channel('student-discussion-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'discussion_posts' }, (payload) => {
        const row = payload.new as { parent_id: string | null; root_id: string | null };
        if (!row.parent_id) {
          qc.invalidateQueries({ queryKey: ['discussion-feed'] });
        } else if (row.root_id) {
          qc.invalidateQueries({ queryKey: ['discussion-thread', row.root_id] });
          qc.invalidateQueries({ queryKey: ['discussion-reply-counts'] });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [meId, qc]);

  const openThread = (rootId: string) => setOpenThreads((s) => new Set(s).add(rootId));
  const toggleThread = (rootId: string) =>
    setOpenThreads((s) => { const n = new Set(s); n.has(rootId) ? n.delete(rootId) : n.add(rootId); return n; });

  return (
    <div className="mx-auto w-full max-w-[760px] px-3 py-4 font-sans sm:px-4 md:py-6">
      <h1 className="px-1 text-xl font-bold text-slate-900 sm:text-2xl">General Discussion</h1>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_14px_rgba(15,23,42,0.04)]">
        <div className="flex border-b border-slate-200 px-2" role="tablist">
          {([['all', 'All Posts'], ['mine', 'My Posts']] as const).map(([id, label]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={cn(
                  'relative px-4 py-3 text-[15px] transition-colors sm:px-5',
                  active
                    ? 'font-semibold text-slate-900 after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:bg-slate-900'
                    : 'text-slate-500 hover:text-slate-800',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        {meId && (
          <div className="p-3 sm:p-4">
            <DiscussionComposer
              meId={meId}
              placeholder="Ask a doubt or share something…"
              onSubmit={async (body, imageUrl) => {
                await createPost({ body, imageUrl, authorId: meId });
                qc.invalidateQueries({ queryKey: ['discussion-feed'] });
              }}
            />
          </div>
        )}
      </div>

      <div className="mt-3 space-y-3">
        {feed.isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)
        ) : posts.length === 0 ? (
          <div className="py-10 text-center">
            <img src="/art/discussion-empty.png" alt="" aria-hidden draggable={false} className="mx-auto h-48 w-48 object-contain" />
            <p className="mt-2 text-sm text-slate-500">
            {tab === 'all' ? 'No posts yet.' : "You haven't posted yet."}
            </p>
          </div>
        ) : (
          posts.map((post) => (
            <ThreadedPost
              key={post.id}
              post={post}
              meId={meId}
              canModerate={canModerate}
              open={openThreads.has(post.id)}
              replyCount={replyCounts[post.id] ?? 0}
              onToggle={() => toggleThread(post.id)}
              onReplySent={(rootId) => {
                openThread(rootId);
                qc.invalidateQueries({ queryKey: ['discussion-thread', rootId] });
                qc.invalidateQueries({ queryKey: ['discussion-reply-counts'] });
              }}
              onChanged={refreshAll}
            />
          ))
        )}
      </div>

      {feed.hasNextPage && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => void feed.fetchNextPage()}
            disabled={feed.isFetchingNextPage}
            className="rounded-md border border-slate-200 bg-white px-5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {feed.isFetchingNextPage ? 'Loading…' : 'Load older posts'}
          </button>
        </div>
      )}
    </div>
  );
};
