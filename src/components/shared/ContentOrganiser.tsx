import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  ensureBucketGroup, useContentBuckets, useInvalidateBuckets, UNSORTED_LABEL,
} from '@/hooks/useContentBuckets';
import { ArrowDown, ArrowUp, FolderPlus, Loader2, Notebook, Trash2, Video } from 'lucide-react';

/**
 * Organise Content — file existing lectures and notes into weeks.
 *
 * Needed for two reasons beyond the Go Live prompt:
 *   - everything uploaded before buckets existed starts out Unsorted;
 *   - most notes are still inserted straight into the database rather than
 *     through the app, so they arrive with no week and always will.
 *
 * Admins see every batch; teachers see only the ones they are assigned to.
 * Both go through the same RLS as everywhere else.
 */

type Kind = 'recordings' | 'notes';

interface Row {
  id: string;
  label: string;
  sub: string | null;
  bucket_id: string | null;
}

export const ContentOrganiser = ({ isAdmin = false }: { isAdmin?: boolean }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const invalidateBuckets = useInvalidateBuckets();

  const [batch, setBatch] = useState('');
  const [subject, setSubject] = useState('');
  const [kind, setKind] = useState<Kind>('recordings');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  /** Which (batch, subject) pairs this user may organise. */
  const { data: scope, isLoading: scopeLoading } = useQuery({
    queryKey: ['organiser-scope', isAdmin, user?.id],
    queryFn: async () => {
      if (isAdmin) {
        // Every pair that actually has content, so the dropdowns never offer
        // an empty combination.
        const [rec, nts] = await Promise.all([
          supabase.from('recordings').select('batch, subject'),
          supabase.from('notes').select('batch, subject'),
        ]);
        const pairs = new Set<string>();
        [...(rec.data ?? []), ...(nts.data ?? [])].forEach((r: { batch: string; subject: string }) => {
          if (r.batch && r.subject) pairs.add(`${r.batch}|${r.subject}`);
        });
        return [...pairs].map((p) => { const [b, s] = p.split('|'); return { batch: b, subject: s }; });
      }
      const { data } = await supabase
        .from('teachers')
        .select('assigned_batches, assigned_subjects')
        .eq('user_id', user!.id)
        .maybeSingle();
      const bs: string[] = data?.assigned_batches ?? [];
      const ss: string[] = data?.assigned_subjects ?? [];
      return bs.flatMap((b) => ss.map((s) => ({ batch: b, subject: s })));
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });

  const batches = useMemo(
    () => [...new Set((scope ?? []).map((p) => p.batch))].sort(),
    [scope],
  );
  const subjects = useMemo(
    () => [...new Set((scope ?? []).filter((p) => p.batch === batch).map((p) => p.subject))].sort(),
    [scope, batch],
  );

  const { data: buckets = [] } = useContentBuckets(batch || undefined, subject || undefined);

  const { data: rows = [], isLoading: rowsLoading } = useQuery<Row[]>({
    queryKey: ['organiser-rows', kind, batch, subject],
    queryFn: async () => {
      if (kind === 'recordings') {
        const { data, error } = await supabase
          .from('recordings')
          .select('id, topic, date, bucket_id')
          .eq('batch', batch).eq('subject', subject)
          .order('date', { ascending: false });
        if (error) throw error;
        return (data ?? []).map((r) => ({ id: r.id, label: r.topic, sub: r.date, bucket_id: r.bucket_id }));
      }
      const { data, error } = await supabase
        .from('notes')
        .select('id, title, filename, created_at, bucket_id')
        .eq('batch', batch).eq('subject', subject)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        label: r.title || r.filename,
        sub: r.created_at ? r.created_at.slice(0, 10) : null,
        bucket_id: r.bucket_id,
      }));
    },
    enabled: !!batch && !!subject,
  });

  const bucketName = (id: string | null) =>
    buckets.find((b) => b.id === id)?.name ?? UNSORTED_LABEL;

  const resetSelection = () => setPicked(new Set());

  const toggle = (id: string) =>
    setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const assign = async (bucketId: string | null) => {
    if (picked.size === 0) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from(kind)
        .update({ bucket_id: bucketId })
        .in('id', [...picked]);
      if (error) throw error;
      toast({
        title: bucketId ? `Moved to ${bucketName(bucketId)}` : 'Moved to Unsorted',
        description: `${picked.size} item${picked.size > 1 ? 's' : ''} updated.`,
      });
      resetSelection();
      queryClient.invalidateQueries({ queryKey: ['organiser-rows', kind, batch, subject] });
      queryClient.invalidateQueries({ queryKey: ['student-recordings', batch, subject] });
      queryClient.invalidateQueries({ queryKey: ['student-notes', batch, subject] });
    } catch (e) {
      toast({ title: 'Could not move these', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const createBucket = async () => {
    const name = newName.trim();
    if (!name || !batch || !subject) return;
    setBusy(true);
    try {
      await ensureBucketGroup(batch, subject, name);
      setNewName('');
      invalidateBuckets();
      toast({ title: `"${name}" created` });
    } catch (e) {
      toast({ title: 'Could not create it', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const move = async (id: string, dir: -1 | 1) => {
    const i = buckets.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= buckets.length) return;
    setBusy(true);
    try {
      // Swap the two positions. Writing both explicitly keeps the order stable
      // even when several buckets were created with the same default position.
      await Promise.all([
        supabase.from('content_buckets').update({ position: j }).eq('id', buckets[i].id),
        supabase.from('content_buckets').update({ position: i }).eq('id', buckets[j].id),
      ]);
      invalidateBuckets();
    } finally {
      setBusy(false);
    }
  };

  const removeBucket = async (id: string) => {
    setBusy(true);
    try {
      // Items keep existing — the FK is ON DELETE SET NULL, so they fall back
      // to Unsorted rather than disappearing with the grouping.
      const { error } = await supabase.from('content_buckets').delete().eq('id', id);
      if (error) throw error;
      invalidateBuckets();
      queryClient.invalidateQueries({ queryKey: ['organiser-rows', kind, batch, subject] });
      toast({ title: 'Bucket removed', description: 'Its items moved to Unsorted.' });
    } catch (e) {
      toast({ title: 'Could not remove it', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const unsortedCount = rows.filter((r) => !r.bucket_id).length;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Organise Content</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Put lectures and notes into weeks. New classes are filed automatically when a teacher
          picks a week at Go Live — this is for everything that came before, and for notes added
          straight to the database.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Choose a subject</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          {scopeLoading ? (
            <Skeleton className="h-10 w-full max-w-md" />
          ) : (
            <>
              <Select value={batch} onValueChange={(v) => { setBatch(v); setSubject(''); resetSelection(); }}>
                <SelectTrigger className="sm:w-80"><SelectValue placeholder="Batch" /></SelectTrigger>
                <SelectContent>
                  {batches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={subject} onValueChange={(v) => { setSubject(v); resetSelection(); }} disabled={!batch}>
                <SelectTrigger className="sm:w-64"><SelectValue placeholder="Subject" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </>
          )}
        </CardContent>
      </Card>

      {batch && subject && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Weeks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Name a new week — Week 1, Chapter 2, Revision…"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') createBucket(); }}
                />
                <Button disabled={!newName.trim() || busy} onClick={createBucket}>
                  <FolderPlus className="mr-2 h-4 w-4" /> Add
                </Button>
              </div>

              {buckets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No weeks yet for this subject.</p>
              ) : (
                <div className="divide-y rounded-lg border">
                  {buckets.map((b, i) => (
                    <div key={b.id} className="flex items-center gap-2 p-2.5">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{b.name}</span>
                      <Badge variant="secondary">
                        {rows.filter((r) => r.bucket_id === b.id).length}
                      </Badge>
                      <Button size="icon" variant="ghost" disabled={i === 0 || busy} onClick={() => move(b.id, -1)}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" disabled={i === buckets.length - 1 || busy} onClick={() => move(b.id, 1)}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" disabled={busy} onClick={() => removeBucket(b.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                Items
                {unsortedCount > 0 && <Badge variant="outline">{unsortedCount} unsorted</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={kind} onValueChange={(v) => { setKind(v as Kind); resetSelection(); }}>
                <TabsList>
                  <TabsTrigger value="recordings"><Video className="mr-2 h-4 w-4" />Lectures</TabsTrigger>
                  <TabsTrigger value="notes"><Notebook className="mr-2 h-4 w-4" />Notes</TabsTrigger>
                </TabsList>
              </Tabs>

              {picked.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3">
                  <span className="text-sm font-medium">{picked.size} selected</span>
                  <Select value={target} onValueChange={setTarget}>
                    <SelectTrigger className="w-56"><SelectValue placeholder="Move to…" /></SelectTrigger>
                    <SelectContent>
                      {buckets.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button disabled={!target || busy} onClick={() => assign(target)}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Move
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => assign(null)}>
                    Clear week
                  </Button>
                  <Button variant="ghost" onClick={resetSelection}>Cancel</Button>
                </div>
              )}

              {rowsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nothing here yet.</p>
              ) : (
                <div className="divide-y rounded-lg border">
                  {rows.map((r) => (
                    <label
                      key={r.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-muted/40',
                        picked.has(r.id) && 'bg-muted/60',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={picked.has(r.id)}
                        onChange={() => toggle(r.id)}
                        className="h-4 w-4 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{r.label}</span>
                        {r.sub && <span className="block text-xs text-muted-foreground">{r.sub}</span>}
                      </span>
                      <Badge variant={r.bucket_id ? 'secondary' : 'outline'} className="shrink-0">
                        {bucketName(r.bucket_id)}
                      </Badge>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
