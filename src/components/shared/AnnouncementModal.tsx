import { useEffect } from 'react';
import { X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { MarkdownText } from '@/components/ui/markdown-text';

interface AnnouncementModalProps {
  title: string;
  message: string;
  imageUrl?: string | null;
  created_at: string;
  created_by_name?: string | null;
  context?: string | null; // optional footer label (e.g. subject/batch)
  onClose: () => void;
}

// Click-to-read announcement popup: ~70% of the screen, white rounded block,
// on a lightly blurred backdrop. Closes on backdrop click or Escape.
export const AnnouncementModal = ({
  title,
  message,
  imageUrl,
  created_at,
  created_by_name,
  context,
  onClose,
}: AnnouncementModalProps) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Blurred, gently dimmed backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-md" />

      {/* White block — ~70% of the screen, very slightly rounded */}
      <div
        className="relative flex flex-col w-[92vw] h-[78vh] sm:w-[70vw] sm:h-[70vh] bg-white rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 sm:px-7 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div className="w-9 h-9 shrink-0 rounded-full overflow-hidden bg-white border border-slate-100 flex items-center justify-center">
            <img
              src="https://res.cloudinary.com/dkywjijpv/image/upload/v1769193106/UI_Logo_yiput4.png"
              alt="UI"
              className="w-full h-full object-contain p-0.5"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 leading-snug">{title}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Sent by {created_by_name || 'Admin'} • {formatDistanceToNow(new Date(created_at), { addSuffix: true })}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full p-1.5 shrink-0 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5">
          <MarkdownText text={message} className="text-[15px] text-slate-700 leading-relaxed" />
          {imageUrl && (
            <img
              src={imageUrl}
              alt=""
              /* Frame follows the image: natural aspect, never cropped. */
              className="mt-4 w-full max-h-[46vh] rounded-lg border border-slate-100 object-contain bg-slate-50"
            />
          )}
        </div>

        {context && (
          <div className="px-5 sm:px-7 py-3 border-t border-slate-100 shrink-0">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">{context}</span>
          </div>
        )}
      </div>
    </div>
  );
};
