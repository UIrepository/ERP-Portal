import { ChevronDown, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StudentBatchHeaderProps {
  selectedBatch: string | null;
  selectedSubject?: string | null;
  batchCount: number;
  onOpenBatchSwitcher: () => void;
}

export const StudentBatchHeader = ({
  selectedBatch,
  selectedSubject,
  batchCount,
  onOpenBatchSwitcher,
}: StudentBatchHeaderProps) => {
  const displayText = selectedSubject 
    ? `${selectedBatch} - ${selectedSubject}`
    : selectedBatch || 'No Batch Selected';

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-b-2xl shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-cyan-400/80 text-xs font-semibold uppercase tracking-wider mb-1.5">
              Selected Batch
            </p>
            <Button
              variant="ghost"
              onClick={batchCount > 1 ? onOpenBatchSwitcher : undefined}
              className={cn(
                "p-0 h-auto text-2xl sm:text-3xl font-bold text-white hover:text-slate-200 hover:bg-transparent flex items-center gap-2 transition-colors",
                batchCount <= 1 && "cursor-default"
              )}
              disabled={batchCount <= 1}
            >
              {displayText}
              {batchCount > 1 && (
                <ChevronDown className="h-5 w-5 text-slate-400" />
              )}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            {batchCount > 1 && (
              <div className="hidden sm:flex items-center gap-2 text-slate-400 text-sm">
                <span className="bg-slate-700/50 px-3 py-1.5 rounded-full text-xs font-medium">
                  {batchCount} batches enrolled
                </span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-400 hover:text-white hover:bg-slate-700/50"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};