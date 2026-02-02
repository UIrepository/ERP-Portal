import { ArrowRight, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StudentSubjectCardProps {
  subject: string;
  onClick: () => void;
  index: number;
}

const subjectColors = [
  'from-blue-500 to-blue-600',
  'from-emerald-500 to-emerald-600',
  'from-violet-500 to-violet-600',
  'from-orange-500 to-orange-600',
  'from-rose-500 to-rose-600',
  'from-cyan-500 to-cyan-600',
  'from-fuchsia-500 to-fuchsia-600',
  'from-amber-500 to-amber-600',
];

const subjectBgColors = [
  'bg-blue-50 hover:bg-blue-100',
  'bg-emerald-50 hover:bg-emerald-100',
  'bg-violet-50 hover:bg-violet-100',
  'bg-orange-50 hover:bg-orange-100',
  'bg-rose-50 hover:bg-rose-100',
  'bg-cyan-50 hover:bg-cyan-100',
  'bg-fuchsia-50 hover:bg-fuchsia-100',
  'bg-amber-50 hover:bg-amber-100',
];

const subjectIconColors = [
  'text-blue-600',
  'text-emerald-600',
  'text-violet-600',
  'text-orange-600',
  'text-rose-600',
  'text-cyan-600',
  'text-fuchsia-600',
  'text-amber-600',
];

export const StudentSubjectCard = ({ subject, onClick, index }: StudentSubjectCardProps) => {
  const colorIndex = index % subjectColors.length;
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full p-6 rounded-2xl text-left transition-all duration-300",
        "border border-slate-200 hover:border-transparent",
        "hover:shadow-xl hover:-translate-y-1",
        subjectBgColors[colorIndex]
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-lg",
            subjectColors[colorIndex]
          )}>
            <BookOpen className="h-7 w-7 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-slate-800 group-hover:text-slate-900">
              {subject}
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Tap to view content
            </p>
          </div>
        </div>
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center transition-all",
          "bg-white shadow-sm group-hover:shadow-md",
          subjectIconColors[colorIndex]
        )}>
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </button>
  );
};
