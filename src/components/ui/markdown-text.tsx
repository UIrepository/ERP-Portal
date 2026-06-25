import React from 'react';
import { cn } from '@/lib/utils';

// Minimal, safe Markdown renderer for announcement bodies. Supports **bold**,
// *italic*, and "- " / "* " bullet lists. Builds React elements only (never
// injects HTML), so there is no XSS surface. Plain text renders unchanged, so
// existing announcements keep working.

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) nodes.push(<strong key={`${keyBase}-b${i++}`}>{m[1]}</strong>);
    else nodes.push(<em key={`${keyBase}-i${i++}`}>{m[2]}</em>);
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

  return <div className={cn('space-y-0.5', className)}>{blocks}</div>;
}
