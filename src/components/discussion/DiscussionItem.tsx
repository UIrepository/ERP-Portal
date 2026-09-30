import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowTurnBackwardIcon, Delete02Icon, MoreVerticalIcon, SmileIcon } from '@hugeicons/core-free-icons';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { DiscussionText } from './DiscussionText';
import { DiscussionComposer } from './DiscussionComposer';
import { REACTIONS, createPost, deletePost, toggleReaction, type DiscussionPost } from './discussionApi';

export const initials = (name?: string | null) =>
  (name ?? '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';

const ago = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;

export const timeAgo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return ago(Math.floor(s / 60), 'min');
  if (s < 86400) return ago(Math.floor(s / 3600), 'hour');
  if (s < 7 * 86400) return ago(Math.floor(s / 86400), 'day');
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

// Soft tint per person (stable from the name), matching the illustration palette.
const AVATAR_TINTS = [
  'bg-[#E8F0FD] text-[#2A5BC4]',
  'bg-[#FDECEC] text-[#C43A43]',
  'bg-[#FFF4DB] text-[#9A6A00]',
  'bg-[#E6F6F1] text-[#1F7A5C]',
  'bg-[#EFEAFB] text-[#5B3FB0]',
];
const tintFor = (name?: string | null) => {
  if (!name) return 'bg-slate-100 text-slate-500';
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
};

export const Avatar = ({ name, small }: { name?: string | null; small?: boolean }) => (
  <span
    className={cn(
      'flex shrink-0 items-center justify-center rounded-full font-semibold',
      tintFor(name),
      small ? 'h-8 w-8 text-[11px]' : 'h-11 w-11 text-[14px]',
    )}
    aria-hidden
  >
    {initials(name)}
  </span>
);

interface DiscussionItemProps {
  post: DiscussionPost;
  meId: string;
  canModerate: boolean;
  depth: number;
  /** Replies to this item, grouped by parent id (for the whole thread). */
  childrenOf?: (id: string) => DiscussionPost[];
  onReplySent: (rootId: string) => void;
  onChanged: () => void;
  /** Top-level only: the "View all N replies" toggle, and whether the thread is loading. */
  footerExtra?: React.ReactNode;
  repliesLoading?: boolean;
}

/** Past this depth replies stop nesting, so long chains stay readable on phones. */
const MAX_NEST = 3;

/**
 * One post or reply. A post is a card (author, text, image, reaction pills,
 * replies footer); a reply is a compact bubble with its own reactions and
 * Reply, recursing into the replies to it.
 */
export const DiscussionItem = ({
  post, meId, canModerate, depth, childrenOf, onReplySent, onChanged, footerExtra, repliesLoading,
}: DiscussionItemProps) => {
  const [replying, setReplying] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Optimistic reactions; replaced by the server copy whenever it refetches.
  const [reactions, setLocalReactions] = useState(post.discussion_reactions);
  useEffect(() => setLocalReactions(post.discussion_reactions), [post.discussion_reactions]);

  const isMine = post.author_id === meId;
  const name = post.is_deleted ? 'Deleted' : post.author?.name ?? 'Student';
  const rootId = post.root_id ?? post.id;
  const replies = childrenOf ? childrenOf(post.id) : [];
  const canDelete = !post.is_deleted && (isMine || canModerate);

  const tally = REACTIONS.map((emoji) => ({
    emoji,
    count: reactions.filter((r) => r.emoji === emoji).length,
    mine: reactions.some((r) => r.emoji === emoji && r.user_id === meId),
  }));

  const react = async (emoji: string) => {
    const mine = reactions.some((r) => r.emoji === emoji && r.user_id === meId);
    const next = mine
      ? reactions.filter((r) => !(r.emoji === emoji && r.user_id === meId))
      : [...reactions, { emoji, user_id: meId }];
    setLocalReactions(next);
    setPickerOpen(false);
    try {
      await toggleReaction(post.id, meId, emoji, !mine);
      onChanged();
    } catch {
      setLocalReactions(post.discussion_reactions);
      toast.error('Could not update your reaction.');
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this message? Replies to it will stay.')) return;
    try {
      await deletePost(post.id);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message || 'Could not delete.');
    }
  };

  const pill = (r: (typeof tally)[number], size: 'lg' | 'sm') => (
    <button
      key={r.emoji}
      type="button"
      onClick={() => void react(r.emoji)}
      aria-pressed={r.mine}
      aria-label={`React ${r.emoji}${r.count ? ` (${r.count})` : ''}`}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-md border transition-colors',
        size === 'lg' ? 'h-8 min-w-[2.6rem] px-2 sm:h-9 sm:min-w-[3rem] sm:px-3' : 'h-7 px-2',
        r.mine ? 'border-[#3B7BE8] bg-[#E8F0FD] text-[#2A5BC4]' : 'border-transparent bg-slate-50 text-slate-700 hover:bg-slate-100',
      )}
    >
      <span className={cn('leading-none', size === 'lg' ? 'text-[17px]' : 'text-[14px]')}>{r.emoji}</span>
      {r.count > 0 && <span className="text-[12.5px] font-semibold tabular-nums">{r.count}</span>}
    </button>
  );

  const body = post.is_deleted ? (
    <p className="text-[14px] italic text-slate-400">This message was deleted.</p>
  ) : (
    <>
      {post.body && (
        <DiscussionText body={post.body} meId={meId} className={depth === 0 ? 'text-[15px]' : 'text-[14px] leading-snug'} />
      )}
      {post.image_url && (
        <button
          type="button"
          onClick={() => window.open(post.image_url!, '_blank', 'noopener')}
          className="mt-3 block max-w-full"
        >
          {/* No frame: the image shows in its own shape; very tall ones are capped. */}
          <img
            src={post.image_url}
            alt="Attached image"
            loading="lazy"
            className={cn('block h-auto w-auto max-w-full rounded-lg border border-slate-200', depth === 0 ? 'max-h-[480px]' : 'max-h-64')}
          />
        </button>
      )}
    </>
  );

  const composer = replying && (
    <DiscussionComposer
      meId={meId}
      compact
      autoFocus
      submitLabel="Reply"
      placeholder={`Reply to ${post.is_deleted ? 'this thread' : name}…`}
      initialMention={!isMine && !post.is_deleted ? { user_id: post.author_id, name } : null}
      onCancel={() => setReplying(false)}
      onSubmit={async (text, imageUrl) => {
        await createPost({ body: text, imageUrl, parentId: post.id, authorId: meId });
        setReplying(false);
        onReplySent(rootId);
      }}
    />
  );

  const childList = (list: DiscussionPost[]) =>
    list.map((r) => (
      <DiscussionItem
        key={r.id}
        post={r}
        meId={meId}
        canModerate={canModerate}
        depth={depth + 1}
        childrenOf={childrenOf}
        onReplySent={onReplySent}
        onChanged={onChanged}
      />
    ));

  // ── Top-level post: a card ─────────────────────────────────────────────
  if (depth === 0) {
    return (
      <article className="rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_14px_rgba(15,23,42,0.04)]">
        <div className="px-4 pb-4 pt-4 sm:px-5">
          <div className="flex items-center gap-3">
            <Avatar name={post.is_deleted ? null : name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-slate-900">
                {name}
                {isMine && !post.is_deleted && <span className="ml-1.5 text-[12px] font-normal text-slate-400">(you)</span>}
              </p>
              <p className="text-[12.5px] text-slate-500">{timeAgo(post.created_at)}</p>
            </div>
            {canDelete && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="More options"
                    className="-mr-2 flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
                  >
                    <HugeiconsIcon icon={MoreVerticalIcon} size={20} strokeWidth={2.2} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[9rem]">
                  <DropdownMenuItem onClick={() => void remove()} className="gap-2 text-red-600 focus:text-red-600">
                    <HugeiconsIcon icon={Delete02Icon} size={15} strokeWidth={1.8} />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="mt-3">{body}</div>

          {!post.is_deleted && <div className="mt-4 flex flex-wrap gap-1.5 sm:gap-2">{tally.map((r) => pill(r, 'lg'))}</div>}
        </div>

        <div className="flex items-center gap-1 border-t border-slate-100 px-2.5 py-1.5 sm:px-3.5">
          {footerExtra}
          <button
            type="button"
            onClick={() => setReplying((v) => !v)}
            className="flex h-9 items-center gap-1.5 rounded-md px-2 text-[13.5px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <HugeiconsIcon icon={ArrowTurnBackwardIcon} size={16} strokeWidth={2} />
            Reply
          </button>
        </div>

        {(composer || replies.length > 0 || repliesLoading) && (
          <div className="space-y-4 border-t border-slate-100 px-4 py-4 sm:px-5">
            {composer}
            {repliesLoading && <Skeleton className="h-14 w-2/3 rounded-lg" />}
            {childList(replies)}
          </div>
        )}
      </article>
    );
  }

  // ── Reply: a compact bubble ────────────────────────────────────────────
  const nestInside = depth < MAX_NEST;
  const shown = tally.filter((r) => r.count > 0);
  return (
    <div>
      <div className="flex gap-2.5">
        <Avatar name={post.is_deleted ? null : name} small />
        <div className="min-w-0 flex-1">
          <div className="inline-block max-w-full rounded-lg bg-slate-100 px-3.5 py-2.5">
            <p className="text-[13.5px] font-bold text-slate-900">
              {name}
              {isMine && !post.is_deleted && <span className="ml-1 text-[11.5px] font-normal text-slate-400">(you)</span>}
            </p>
            <div className="mt-0.5">{body}</div>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 pl-1 text-[12.5px]">
            <span className="mr-1 text-slate-400">{timeAgo(post.created_at)}</span>
            {!post.is_deleted && (
              <>
                {shown.map((r) => pill(r, 'sm'))}
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="Add reaction"
                      className="flex h-7 items-center gap-1 rounded-md px-1.5 font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    >
                      <HugeiconsIcon icon={SmileIcon} size={14} strokeWidth={2} />
                      React
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="w-auto rounded-md p-1">
                    <div className="flex gap-0.5">
                      {REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => void react(emoji)}
                          className="flex h-10 w-10 items-center justify-center rounded-md text-[22px] leading-none transition-transform hover:scale-110 hover:bg-slate-100"
                          aria-label={`React ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            )}
            <button
              type="button"
              onClick={() => setReplying((v) => !v)}
              className="flex h-7 items-center rounded-md px-1.5 font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              Reply
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={() => void remove()}
                className="flex h-7 items-center rounded-md px-1.5 font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                Delete
              </button>
            )}
          </div>

          {composer && <div className="mt-2">{composer}</div>}
          {nestInside && replies.length > 0 && <div className="mt-3 space-y-3">{childList(replies)}</div>}
        </div>
      </div>
      {!nestInside && replies.length > 0 && <div className="mt-3 space-y-3">{childList(replies)}</div>}
    </div>
  );
};
