import { useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Bold, Italic, List } from 'lucide-react';
import { cn } from '@/lib/utils';

// A lightweight Markdown editor: a plain textarea (so the value stays portable
// text for push/email) plus a toolbar and keyboard shortcuts that insert
// Markdown — **bold** (Ctrl/Cmd+B), *italic* (Ctrl/Cmd+I), and "- " bullets.
// Render the value with <MarkdownText/> to show the formatting.

interface RichTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

export const RichTextArea = ({ value, onChange, placeholder, rows = 6, className }: RichTextAreaProps) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Wrap the current selection in a token (e.g. ** or *), keeping it selected.
  const wrap = (token: string) => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const sel = value.slice(start, end);
    const next = value.slice(0, start) + token + sel + token + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const a = start + token.length;
      ta.setSelectionRange(a, a + sel.length);
    });
  };

  // Toggle "- " bullets on every line touched by the selection.
  const bullet = () => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = value.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = value.length;
    const block = value.slice(lineStart, lineEnd);
    const lines = block.length ? block.split('\n') : [''];
    const allBulleted = lines.every((l) => l.trim() === '' || /^\s*[-*]\s+/.test(l));
    const nb = lines
      .map((l) => (l.trim() === '' ? l : allBulleted ? l.replace(/^(\s*)[-*]\s+/, '$1') : `- ${l}`))
      .join('\n');
    onChange(value.slice(0, lineStart) + nb + value.slice(lineEnd));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(lineStart, lineStart + nb.length);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'b') {
      e.preventDefault();
      wrap('**');
    } else if (k === 'i') {
      e.preventDefault();
      wrap('*');
    }
  };

  return (
    <div className={cn('rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2', className)}>
      <div className="flex items-center gap-0.5 border-b px-1.5 py-1">
        {[
          { icon: Bold, title: 'Bold (Ctrl+B)', onClick: () => wrap('**') },
          { icon: Italic, title: 'Italic (Ctrl+I)', onClick: () => wrap('*') },
          { icon: List, title: 'Bulleted list', onClick: bullet },
        ].map(({ icon: Icon, title, onClick }) => (
          <Button
            key={title}
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-600"
            title={title}
            // Keep the textarea's selection while clicking the toolbar.
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
        <span className="ml-auto pr-1 text-[10px] text-slate-400 hidden sm:block">**bold** · *italic* · - list</span>
      </div>
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={rows}
        className="border-0 rounded-t-none resize-y focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
      />
    </div>
  );
};
