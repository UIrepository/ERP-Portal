import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { MENTION_RE } from './discussionApi';

const URL_RE = /(https?:\/\/[^\s<>]+)/g;

/** Plain text with clickable links. Rendered as React nodes — never raw HTML. */
const linkify = (text: string, keyPrefix: string): ReactNode[] =>
  text.split(URL_RE).map((part, i) => {
    if (i % 2 === 1) {
      const trail = part.match(/[),.;:!?\]]+$/)?.[0] ?? '';
      const url = trail ? part.slice(0, -trail.length) : part;
      return (
        <Fragment key={`${keyPrefix}-${i}`}>
          <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-brand underline-offset-2 hover:underline">
            {url}
          </a>
          {trail}
        </Fragment>
      );
    }
    return <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>;
  });

/**
 * A discussion message body. @[Name](id) tokens become highlighted mentions
 * (stronger when it is you), URLs become links, line breaks are kept.
 */
export const DiscussionText = ({ body, meId, className }: { body: string; meId?: string; className?: string }) => {
  const nodes: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const m of body.matchAll(MENTION_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) nodes.push(...linkify(body.slice(last, idx), `t${n}`));
    const isMe = m[2] === meId;
    nodes.push(
      <span
        key={`m${n}`}
        className={cn(
          'rounded px-1 font-medium',
          isMe ? 'bg-brand text-white' : 'bg-brand/10 text-brand',
        )}
      >
        @{m[1]}
      </span>,
    );
    last = idx + m[0].length;
    n += 1;
  }
  if (last < body.length) nodes.push(...linkify(body.slice(last), 'end'));
  return <p className={cn('whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-slate-800', className)}>{nodes}</p>;
};
