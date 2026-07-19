import React from 'react';
import { cn } from '@/lib/utils';

// Minimal, safe Markdown renderer for announcement bodies. Supports **bold**,
// *italic*, "- " / "* " bullet lists, and auto-links pasted URLs. Builds React
// elements only (never injects HTML), so there is no XSS surface. Plain text
// renders unchanged, so existing announcements keep working.

// http(s):// links, plus bare www. links. Stops at whitespace / angle brackets.
const INLINE_SRC = /\*\*(.+?)\*\*|\*(.+?)\*|((?:https?:\/\/|www\.)[^\s<>]+)/.source;

function renderLink(raw: string, key: string): React.ReactNode[] {
  // Don't swallow sentence punctuation that trails a pasted link.
  let url = raw;
  let trail = '';
  const t = url.match(/[),.;:!?\]]+$/);
  if (t) {
    trail = t[0];
    url = url.slice(0, url.length - trail.length);
  }
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const out: React.ReactNode[] = [
    <a
      key={key}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      // Announcement cards are clickable (they open the popup) — keep a link
      // click from also triggering the card.
      onClick={(e) => e.stopPropagation()}
      className="text-blue-600 underline underline-offset-2 decoration-blue-300 hover:text-blue-700 break-words"
    >
      {url}
    </a>,
  ];
  if (trail) out.push(trail);
  return out;
}

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = new RegExp(INLINE_SRC, 'g');
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) nodes.push(<strong key={`${keyBase}-b${i++}`}>{m[1]}</strong>);
    else if (m[2] !== undefined) nodes.push(<em key={`${keyBase}-i${i++}`}>{m[2]}</em>);
    else nodes.push(...renderLink(m[3], `${keyBase}-a${i++}`));
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function MarkdownText({ text, className }: { text: string; className?: string }) {
  const lines = (text || '').split('\n');
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];
  let k = 0;

  const flush = () => {
    if (bullets.length === 0) return;
    const items = bullets;
    const key = k++;
    blocks.push(
      <ul key={`ul-${key}`} className="list-disc pl-5 space-y-0.5 my-1">
        {items.map((it, idx) => (
          <li key={idx}>{renderInline(it, `li-${key}-${idx}`)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  lines.forEach((line, idx) => {
    const b = line.match(/^\s*[-*]\s+(.*)$/);
    if (b) {
      bullets.push(b[1]);
      return;
    }
    flush();
    if (line.trim() === '') {
      blocks.push(<div key={`sp-${k++}`} className="h-2" />);
      return;
    }
    blocks.push(
      <p key={`p-${k++}`} className="my-0">
        {renderInline(line, `p-${idx}`)}
      </p>,
    );
  });
  flush();

  return (
    <div
      // Announcement bodies stay copy/paste friendly: text is selectable and the
      // browser's own context menu is allowed through (the app-wide
      // screen-recording guard suppresses right-click everywhere else).
      onContextMenu={(e) => e.stopPropagation()}
      className={cn('space-y-0.5 select-text', className)}
    >
      {blocks}
    </div>
  );
}
