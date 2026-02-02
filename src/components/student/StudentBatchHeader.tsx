import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StudentBatchHeaderProps {
  selectedBatch: string | null;
  batchCount: number;
  onOpenBatchSwitcher: () => void;
}

export const StudentBatchHeader = ({
  selectedBatch,
  batchCount,
  onOpenBatchSwitcher,
}: StudentBatchHeaderProps) => {
  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm font-medium mb-1">Current Batch</p>
            <Button
              variant="ghost"
              onClick={batchCount > 1 ? onOpenBatchSwitcher : undefined}
              className={cn(
                "p-0 h-auto text-3xl font-bold text-white hover:text-slate-200 hover:bg-transparent flex items-center gap-2 transition-colors",
                batchCount <= 1 && "cursor-default"
              )}
              disabled={batchCount <= 1}
            >
              {selectedBatch || 'No Batch Selected'}
              {batchCount > 1 && (
                <ChevronDown className="h-6 w-6 text-slate-400" />
              )}
            </Button>
          </div>
          {batchCount > 1 && (
            <div className="hidden sm:flex items-center gap-2 text-slate-400 text-sm">
              <span className="bg-slate-700/50 px-3 py-1 rounded-full">
                {batchCount} batches enrolled
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
