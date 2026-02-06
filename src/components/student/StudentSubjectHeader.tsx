import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface StudentSubjectHeaderProps {
  batch: string;
  subject?: string | null;
  block?: string | null;
  blockLabel?: string;
  onBack: () => void;
}

export const StudentSubjectHeader = ({
  onBack,
}: StudentSubjectHeaderProps) => {
  return (
    <div className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 -ml-2 px-3 py-2 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm font-medium">Back</span>
        </Button>
      </div>
    </div>
  );
};
