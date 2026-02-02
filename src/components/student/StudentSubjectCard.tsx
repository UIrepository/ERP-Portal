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
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "group flex items-center p-[22px]",
        "bg-white border border-[#f1f5f9] rounded-[14px]",
        "transition-all duration-250 ease-in-out",
        "hover:translate-y-[-3px] hover:border-[#0d9488] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.05)]",
        "w-full text-left"
      )}
    >
      <div className="w-[55px] h-[55px] flex items-center justify-center mr-[18px] rounded-[12px] bg-[#f8fafc] shrink-0">
        <Icon className={cn("h-8 w-8", colorClass)} strokeWidth={1.5} />
      </div>
      
      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] font-semibold text-[#1e293b] mb-[3px] truncate group-hover:text-[#0d9488] transition-colors">
          {subject}
        </h3>
        <span className="text-[13px] text-[#64748b]">
          View Content
        </span>
      </div>
      
      <ArrowRight className="h-5 w-5 text-[#e2e8f0] group-hover:text-[#0d9488] transition-colors" />
    </button>
  );
};
