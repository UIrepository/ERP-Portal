import { cn } from '@/lib/utils';

interface StudentSubjectCardProps {
  subject: string;
  index: number;
  onClick: () => void;
}

// Illustrated cover for the common subjects; others fall back to the general one.
const getSubjectArt = (subject: string) => {
  const s = subject.toLowerCase();
  if (s.includes('stat')) return '/art/sub-stats.png';
  if (s.includes('math')) return '/art/sub-maths.png';
  if (s.includes('computational') || /ct/.test(s)) return '/art/sub-ct.png';
  if (s.includes('python') || s.includes('program') || s.includes('java') || s.includes('code') || s.includes('computer')) return '/art/sub-programming.png';
  if (s.includes('english')) return '/art/sub-english.png';
  return '/art/sub-general.png';
};

export const StudentSubjectCard = ({ subject, index, onClick }: StudentSubjectCardProps) => {
  const art = getSubjectArt(subject);

  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full text-left relative",
        // Mobile: p-4, Desktop: p-6
        "bg-white p-3.5 sm:p-6 rounded-xl",
        "border-[1.5px] border-[#f3f4f6]", 
        "hover:border-black", 
        "shadow-[0_1px_3px_rgba(0,0,0,0.05)]", 
        "hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:-translate-y-[1px]",
        "transition-all duration-200 ease-in-out",
        // Mobile: gap-3, Desktop: gap-5
        "flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-5", 
        "font-sans"
      )}
    >
      {/* Icon Container - Scaled for mobile */}
      <img src={art} alt="" aria-hidden draggable={false} className="h-12 w-12 shrink-0 object-contain sm:h-20 sm:w-20" />

      {/* Subject Info */}
      <div className="min-w-0 flex-1">
        {/* Mobile: text-[15px], Desktop: text-[18px]. Removed 'truncate' to show full name. */}
        <h3 className="text-[14px] sm:text-[18px] font-semibold text-slate-900 leading-snug tracking-tight [overflow-wrap:normal] [word-break:normal] hyphens-auto">
          {subject}
        </h3>
      </div>
    </button>
  );
};
