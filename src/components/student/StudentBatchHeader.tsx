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
    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-indigo-700 to-indigo-500 text-white rounded-b-2xl shadow-xl">
      {/* Premium light glows over the deep base for a mesh-gradient feel */}
      <div className="pointer-events-none absolute -top-20 -right-12 h-60 w-60 rounded-full bg-indigo-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/4 h-52 w-52 rounded-full bg-indigo-400/25 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(255,255,255,0.10),transparent_55%)]" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wider mb-1.5">
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
                <ChevronDown className="h-5 w-5 text-indigo-200" />
              )}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            {batchCount > 1 && (
              <div className="hidden sm:flex items-center gap-2 text-sm">
                <span className="bg-white/10 border border-white/15 backdrop-blur-sm text-white/90 px-3 py-1.5 rounded-full text-xs font-medium">
                  {batchCount} batches enrolled
                </span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};