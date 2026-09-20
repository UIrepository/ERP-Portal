import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ensureBucketGroup, useContentBuckets, useInvalidateBuckets } from '@/hooks/useContentBuckets';
import { FolderPlus, Layers, Loader2 } from 'lucide-react';

/**
 * "Which week is this class in?" — shown before a teacher goes live.
 *
 * Deliberately has no skip: the whole point is that every lecture lands in a
 * week so students get a tidy list instead of 200 undated cards. But it also
 * never blocks the class. If the teacher closes it or something fails, the
 * caller starts the stream anyway and the recording lands in Unsorted, which
 * they can fix afterwards from Organise Content. Losing the grouping for an
 * hour is a far smaller problem than not being able to teach.
 *
 * Picking a name creates it in every batch of the merge group, so a merged
 * class keeps its grouping in all of them.
 */

interface Props {
  open: boolean;
  batch: string;
  subject: string;
  /**
   * Bucket ids keyed "batch|subject" for EVERY pair in the merge group. Going
   * live writes one recording per pair and each needs its own bucket, so the
   * caller gets the whole map rather than a single id.
   */
  onConfirm: (byPair: Record<string, string>) => void;
  onCancel: () => void;
}

export const BucketPickerDialog = ({ open, batch, subject, onConfirm, onCancel }: Props) => {
  const { data: buckets = [], isLoading } = useContentBuckets(
    open ? batch : undefined,
    open ? subject : undefined,
  );
  const invalidate = useInvalidateBuckets();

  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCreating(false);
    setNewName('');
    setBusy(false);
  }, [open]);

  // Preselect the newest week. Most classes continue the week they were last
  // in, so the common case becomes a single click — and the teacher can still
  // pick another one or create a new week from the same screen.
  useEffect(() => {
    if (!open || buckets.length === 0) return;
    setSelected((cur) => cur ?? buckets[buckets.length - 1].id);
  }, [open, buckets]);

  const suggestion = useMemo(() => {
    // Offer the obvious next name when the existing ones are "Week <n>".
    const nums = buckets
      .map((b) => /^week\s*(\d+)$/i.exec(b.name.trim())?.[1])
      .filter(Boolean)
      .map(Number);
    return nums.length ? `Week ${Math.max(...nums) + 1}` : 'Week 1';
  }, [buckets]);

  const confirmExisting = async () => {
    const bucket = buckets.find((b) => b.id === selected);
    if (!bucket) return;
    setBusy(true);
    try {
      // Go through ensure_bucket_group even for an existing bucket: the merge
      // group may have grown since it was made, and the partner batches need
      // the same name to exist before the recordings are written.
      const { byPair } = await ensureBucketGroup(batch, subject, bucket.name);
      onConfirm(byPair);
    } catch (e) {
      console.error('bucket resolve failed', e);
      toast({ title: 'Could not set the week', description: (e as Error).message, variant: 'destructive' });
      setBusy(false);
    }
  };

  const confirmNew = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const { byPair } = await ensureBucketGroup(batch, subject, name);
      invalidate();
      onConfirm(byPair);
    } catch (e) {
      console.error('bucket create failed', e);
      toast({ title: 'Could not create the week', description: (e as Error).message, variant: 'destructive' });
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onCancel(); }}>
      <DialogContent className="max-w-md gap-0 p-6 sm:rounded-[24px]">
        <DialogHeader className="space-y-0">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle className="pr-10 text-left text-lg font-semibold tracking-tight">
            Which week is this class in?
          </DialogTitle>
        </DialogHeader>

        <p className="mt-2 text-sm text-muted-foreground">
          Today's recording — and the whiteboard notes you save — will be filed here for{' '}
          <span className="font-medium text-foreground">{subject}</span>.
        </p>

        {isLoading ? (
          <div className="mt-5 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-11 w-full" />)}
          </div>
        ) : creating || buckets.length === 0 ? (
          <div className="mt-5 space-y-3">
            <Input
              autoFocus
              value={newName}
              placeholder={suggestion}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) confirmNew(); }}
            />
            {buckets.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No weeks yet for this subject. Name the first one — anything works: Week 1,
                Chapter 1, Induction.
              </p>
            )}
            <div className="flex gap-2">
              <Button className="flex-1" disabled={!newName.trim() || busy} onClick={confirmNew}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create &amp; go live
              </Button>
              {buckets.length > 0 && (
                <Button variant="outline" disabled={busy} onClick={() => setCreating(false)}>
                  Back
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {buckets.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelected(b.id)}
                  className={cn(
                    'w-full rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors',
                    selected === b.id
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border hover:border-foreground/30',
                  )}
                >
                  {b.name}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              className="w-full justify-start"
              disabled={busy}
              onClick={() => { setCreating(true); setNewName(''); }}
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              Create a new week
            </Button>

            <Button className="w-full" disabled={!selected || busy} onClick={confirmExisting}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Go live in “{buckets.find((b) => b.id === selected)?.name ?? '…'}”
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
