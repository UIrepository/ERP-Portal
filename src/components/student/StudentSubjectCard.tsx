import { ArrowRight, BookOpen, Microscope, Calculator, FlaskConical, Beaker, TestTube2, FileText, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudentSubjectCardProps {
  subject: string;
  onClick: () => void;
  index: number;
}

// Map subject names to specific icons and colors to match the design
const getSubjectConfig = (subjectName: string): { icon: LucideIcon; colorClass: string } => {
  const lowerName = subjectName.toLowerCase();
  
  if (lowerName.includes('physics')) {
    return { icon: Microscope, colorClass: 'text-sky-600' }; // .ic-phys
  }
  if (lowerName.includes('math')) {
    return { icon: Calculator, colorClass: 'text-emerald-600' }; // .ic-math
  }
  if (lowerName.includes('physical') && lowerName.includes('chem')) {
    return { icon: FlaskConical, colorClass: 'text-teal-600' }; // .ic-chem
  }
  if (lowerName.includes('organic') && lowerName.includes('chem')) {
    return { icon: Beaker, colorClass: 'text-teal-600' };
  }
  if (lowerName.includes('inorganic') && lowerName.includes('chem')) {
    return { icon: TestTube2, colorClass: 'text-teal-600' };
  }
  if (lowerName.includes('chem')) {
    return { icon: FlaskConical, colorClass: 'text-teal-600' };
  }
  
  // Default fallback
  return { icon: BookOpen, colorClass: 'text-amber-600' }; // .ic-note default
};

export const StudentSubjectCard = ({ subject, onClick, index }: StudentSubjectCardProps) => {
  const { icon: Icon, colorClass } = getSubjectConfig(subject);
  
  // Fake chapter count for display
  const chapterCount = 5 + (index % 4);
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex items-center p-3",
        "bg-white border border-slate-100 rounded-lg",
        "transition-all duration-200",
        "hover:border-violet-300 hover:shadow-sm",
        "w-full text-left"
      )}
    >
      <div className="w-10 h-10 flex items-center justify-center mr-3 rounded-lg bg-slate-50 shrink-0">
        <Icon className={cn("h-5 w-5", colorClass)} strokeWidth={1.5} />
      </div>
      
      <div className="flex-1 min-w-0">
        <h3 className="text-[13px] font-semibold text-slate-800 truncate group-hover:text-violet-600 transition-colors">
          {subject}
        </h3>
        <span className="text-[11px] text-slate-500">
          {chapterCount} Chapters
        </span>
      </div>
    </button>
  );
};
