import { useEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Image01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { uploadImageToCloudinary } from '@/lib/cloudinary';
import { searchPeople, type MentionCandidate } from './discussionApi';

interface DiscussionComposerProps {
  meId: string;
  placeholder: string;
  submitLabel?: string;
  compact?: boolean;
  autoFocus?: boolean;
  /** Pre-filled "@Name " when replying to someone. */
  initialMention?: MentionCandidate | null;
  onSubmit: (body: string, imageUrl: string | null) => Promise<void>;
  onCancel?: () => void;
}

const MAX_IMAGE_MB = 8;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Text box for a post or reply: @mention autocomplete (names only), optional
 * image, Ctrl/⌘+Enter to send. Mentions are typed as "@Name" and converted to
 * @[Name](id) tokens only when sending, so the text stays readable while typing.
 */
export const DiscussionComposer = ({
  meId, placeholder, submitLabel = 'Post', compact, autoFocus, initialMention, onSubmit, onCancel,
}: DiscussionComposerProps) => {
  const [text, setText] = useState(initialMention ? `@${initialMention.name} ` : '');
  const [mentions, setMentions] = useState<Record<string, string>>(
    initialMention ? { [initialMention.name]: initialMention.user_id } : {},
  );
  const [query, setQuery] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<MentionCandidate[]>([]);
  const [active, setActive] = useState(0);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && boxRef.current) {
      const el = boxRef.current;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [autoFocus]);

  // Grow with the text, up to a limit.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [text]);

  // People search for the @ token being typed.
  useEffect(() => {
    if (query === null || query.trim().length < 2) { setSuggestions([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await searchPeople(query, meId);
        if (!cancelled) { setSuggestions(res); setActive(0); }
      } catch { if (!cancelled) setSuggestions([]); }
    }, 180);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, meId]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const detectMention = (value: string, caret: number) => {
    const before = value.slice(0, caret);
    const m = before.match(/(?:^|\s)@([A-Za-z][A-Za-z .'-]{0,29})$/);
    setQuery(m ? m[1] : null);
  };

  const pick = (p: MentionCandidate) => {
    const el = boxRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? text.length;
    const before = text.slice(0, caret).replace(/@([A-Za-z][A-Za-z .'-]{0,29})$/, `@${p.name} `);
    const next = before + text.slice(caret);
    setText(next);
    setMentions((m) => ({ ...m, [p.name]: p.user_id }));
    setQuery(null);
    setSuggestions([]);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(before.length, before.length); });
  };

  const onPickImage = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast.error('Please choose an image file.'); return; }
    if (f.size > MAX_IMAGE_MB * 1024 * 1024) { toast.error(`Images must be under ${MAX_IMAGE_MB} MB.`); return; }
    if (preview) URL.revokeObjectURL(preview);
    setImage(f);
    setPreview(URL.createObjectURL(f));
  };

  const clearImage = () => {
    if (preview) URL.revokeObjectURL(preview);
    setImage(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const canSend = !busy && (text.trim().length > 0 || !!image);

  const send = async () => {
    if (!canSend) return;
    setBusy(true);
    try {
      // "@Name" → "@[Name](id)" for every person picked from the list.
      let body = text.trim();
      Object.entries(mentions)
        .sort((a, b) => b[0].length - a[0].length) // longer names first ("Riya Sharma" before "Riya")
        .forEach(([name, id]) => {
          body = body.replace(new RegExp(`(^|[^\\[])@${escapeRe(name)}(?![\\w\\]])`, 'g'), `$1@[${name}](${id})`);
        });
      const imageUrl = image ? await uploadImageToCloudinary(image, 'discussion_uploads') : null;
      await onSubmit(body, imageUrl);
      setText('');
      setMentions({});
      clearImage();
    } catch (e) {
      toast.error((e as Error).message || 'Could not send. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % suggestions.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + suggestions.length) % suggestions.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(suggestions[active]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setSuggestions([]); setQuery(null); return; }
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send(); }
    if (e.key === 'Escape' && onCancel) onCancel();
  };

  return (
    <div className={cn('relative rounded-lg border border-slate-200 bg-white focus-within:border-slate-300', compact ? 'p-2.5' : 'p-3')}>
      <textarea
        ref={boxRef}
        value={text}
        rows={compact ? 1 : 2}
        placeholder={placeholder}
        maxLength={3500}
        onChange={(e) => { setText(e.target.value); detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length); }}
        onClick={(e) => detectMention(text, (e.target as HTMLTextAreaElement).selectionStart ?? text.length)}
        onKeyDown={onKeyDown}
        className="block w-full resize-none bg-transparent text-[14.5px] leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none"
        aria-label={placeholder}
      />

      {/* @mention suggestions — names only */}
      {suggestions.length > 0 && (
        <div className="absolute left-3 right-3 top-full z-30 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg sm:right-auto sm:w-72" role="listbox">
          {suggestions.map((p, i) => (
            <button
              key={p.user_id}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(p); }}
              onMouseEnter={() => setActive(i)}
              className={cn('flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm', i === active ? 'bg-slate-100' : 'bg-white')}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                {p.name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
              </span>
              <span className="truncate text-slate-800">{p.name}</span>
            </button>
          ))}
        </div>
      )}

      {preview && (
        <div className="relative mt-2 inline-block">
          <img src={preview} alt="Attachment preview" className="max-h-32 max-w-[12rem] rounded-md border border-slate-200" />
          <button
            type="button"
            onClick={clearImage}
            aria-label="Remove image"
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white shadow"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={2.2} />
          </button>
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPickImage(e.target.files?.[0])} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          aria-label="Attach image"
        >
          <HugeiconsIcon icon={Image01Icon} size={17} strokeWidth={1.8} />
          {!compact && <span>Image</span>}
        </button>
        <div className="ml-auto flex items-center gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="h-8 rounded-md px-3 text-[13px] text-slate-500 hover:bg-slate-100">
              Cancel
            </button>
          )}
          <button
            type="button"
            disabled={!canSend}
            onClick={() => void send()}
            className="flex h-8 items-center rounded-md bg-slate-900 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400"
          >
            {busy ? 'Posting…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
