import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StudentSubjectHeaderProps {
  batch: string;
  subject?: string | null;
  block?: string | null;
  blockLabel?: string;
  onBack: () => void;
}

export const StudentSubjectHeader = ({
  batch,
  subject,
  block,
  blockLabel,
  onBack,
}: StudentSubjectHeaderProps) => {
  return (
    <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 -ml-2 p-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <nav className="flex items-center text-sm">
            <span className="text-slate-500 font-medium">{batch}</span>
            {subject && (
              <>
                <ChevronRight className="h-4 w-4 text-slate-400 mx-1.5" />
                <span className={block ? 'text-slate-500' : 'text-slate-900 font-semibold'}>
                  {subject}
                </span>
              </>
            )}
            {block && blockLabel && (
              <>
                <ChevronRight className="h-4 w-4 text-slate-400 mx-1.5" />
                <span className="text-slate-900 font-semibold">{blockLabel}</span>
              </>
            )}
          </nav>
        </div>
      </div>
    </div>
  );
};
