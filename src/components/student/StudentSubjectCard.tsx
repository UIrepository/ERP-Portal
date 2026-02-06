import { 
  Calculator, 
  Atom, 
  FlaskConical, 
  Dna, 
  Microscope, 
  Globe, 
  BookOpen, 
  Music, 
  Palette, 
  Code,
  GraduationCap,
  Megaphone
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudentSubjectCardProps {
  subject: string;
  index: number;
  onClick: () => void;
}

// Helper to get icon based on subject name
const getSubjectIcon = (subject: string) => {
  const normalized = subject.toLowerCase();
  if (normalized.includes('math')) return Calculator;
  if (normalized.includes('physics')) return Atom;
  if (normalized.includes('chemistry')) return FlaskConical;
  if (normalized.includes('biology') || normalized.includes('botany') || normalized.includes('zoology')) return Dna;
  if (normalized.includes('science')) return Microscope;
  if (normalized.includes('history') || normalized.includes('geography')) return Globe;
  if (normalized.includes('english') || normalized.includes('hindi')) return BookOpen;
  if (normalized.includes('music')) return Music;
  if (normalized.includes('art')) return Palette;
  if (normalized.includes('computer') || normalized.includes('code')) return Code;
  if (normalized.includes('notice') || normalized.includes('announce')) return Megaphone;
  return GraduationCap;
};

export const StudentSubjectCard = ({ subject, index, onClick }: StudentSubjectCardProps) => {
  const Icon = getSubjectIcon(subject);

  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full text-left relative",
        "bg-white p-6 rounded-xl",
        "border-[1.5px] border-[#f3f4f6]", // Default subtle border
        "hover:border-black", // Black border on hover
        "shadow-[0_1px_3px_rgba(0,0,0,0.05)]", // Subtle shadow
        "hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:-translate-y-[1px]",
        "transition-all duration-200 ease-in-out",
        "flex items-center gap-5", // Flex layout: Icon left, Text right
        "font-sans" // Ensures Inter font
      )}
    >
      {/* Icon Container - Matching the specific blue from your snippet */}
      <div className="shrink-0 text-[#5d87a8]"> 
        <Icon strokeWidth={1.5} className="h-8 w-8" />
      </div>

      {/* Subject Info */}
      <div className="min-w-0 flex-1">
        <h3 className="text-[18px] font-semibold text-slate-900 truncate tracking-tight">
          {subject}
        </h3>
        {/* Chapters count removed as requested */}
      </div>
    </button>
  );
};
