import { X, Check, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface StudentBatchSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  batches: string[];
  selectedBatch: string | null;
  onSelectBatch: (batch: string) => void;
}

export const StudentBatchSwitcher = ({
  isOpen,
  onClose,
  batches,
  selectedBatch,
  onSelectBatch,
}: StudentBatchSwitcherProps) => {
  const handleSelect = (batch: string) => {
    onSelectBatch(batch);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 border-l border-slate-200">
        <SheetHeader className="p-6 border-b bg-gradient-to-r from-slate-800 to-slate-900 text-white">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-white text-xl font-bold flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Switch Batch
            </SheetTitle>
          </div>
          <p className="text-slate-300 text-sm mt-1">
            Select a batch to view its subjects and content
          </p>
        </SheetHeader>
        
        <div className="p-4 space-y-2">
          {batches.map((batch) => {
            const isSelected = batch === selectedBatch;
            return (
              <button
                key={batch}
                onClick={() => handleSelect(batch)}
                className={cn(
                  "w-full p-4 rounded-xl text-left transition-all duration-200 flex items-center justify-between group",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 hover:shadow-md"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg",
                    isSelected ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                  )}>
                    {batch.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-base">{batch}</p>
                    <p className={cn(
                      "text-xs",
                      isSelected ? "text-primary-foreground/70" : "text-slate-500"
                    )}>
                      Click to switch
                    </p>
                  </div>
                </div>
                {isSelected && (
                  <Check className="h-5 w-5" />
                )}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};
