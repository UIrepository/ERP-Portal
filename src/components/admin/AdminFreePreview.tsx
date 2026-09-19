import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { Eye, EyeOff, FileText, Search, Sparkles, Video, Notebook } from 'lucide-react';

/**
 * Free Preview — decides what a visitor on unknowniitians.com can actually open
 * before they have paid.
 *
 * Everything on this screen is driven by content_catalog, which is generated
 * from the real recordings / notes / DPPs. There is no list of batches or
 * subjects written down anywhere: add a lecture in the portal and it shows up
 * here, ready to be marked free.
 *
 * Two levels of control:
 *   - the batch switch decides whether the course page shows an Explore section
 *     at all (titles are visible to everyone when it is on, nothing plays);
 *   - the per-item switch decides which single lectures/notes actually open for
 *     a signed-in visitor who has not bought the batch.
 */

type CatalogItem = {
  id: string;
  source_table: 'recordings' | 'notes' | 'dpp_content';
  source_id: string;
  subject: string;
  content_type: 'video' | 'note' | 'dpp';
  title: string;
  content_date: string | null;
  is_free_preview: boolean;
};

const TYPE_META = {
  video: { label: 'Lecture', icon: Video },
  note:  { label: 'Note',    icon: Notebook },
  dpp:   { label: 'DPP',     icon: FileText },
} as const;

export const AdminFreePreview = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [batch, setBatch] = useState('');
  const [subject, setSubject] = useState('all');
  const [search, setSearch] = useState('');

  const { data: batches = [], isLoading: batchesLoading } = useQuery<string[]>({
    queryKey: ['catalog-batches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_catalog')
        .select('batch')
        .order('batch');
      if (error) throw error;
      return [...new Set((data ?? []).map((r) => r.batch as string))];
    },
    staleTime: 5 * 60_000,
  });

  const { data: settings } = useQuery({
    queryKey: ['preview-settings', batch],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_preview_settings')
        .select('batch, is_preview_enabled')
        .eq('batch', batch)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!batch,
  });

  // No row means the batch has never been configured, which the public endpoint
  // treats as enabled — mirror that here so the switch tells the truth.
  const previewEnabled = settings?.is_preview_enabled ?? true;

  const { data: items = [], isLoading: itemsLoading } = useQuery<CatalogItem[]>({
    queryKey: ['catalog-items', batch],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('content_catalog')
        .select('id, source_table, source_id, subject, content_type, title, content_date, is_free_preview')
        .eq('batch', batch)
        .order('subject')
        .order('sort_key', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CatalogItem[];
    },
    enabled: !!batch,
  });

  const subjects = useMemo(
    () => [...new Set(items.map((i) => i.subject))].sort(),
    [items],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (subject === 'all' || i.subject === subject) &&
        (!needle || i.title.toLowerCase().includes(needle)),
    );
  }, [items, subject, search]);

  const freeCount = items.filter((i) => i.is_free_preview).length;

  const toggleBatch = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('content_preview_settings')
        .upsert(
          { batch, is_preview_enabled: enabled, updated_by: user?.id ?? null, updated_at: new Date().toISOString() },
          { onConflict: 'batch' },
        );
      if (error) throw error;
    },
    onSuccess: (_d, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['preview-settings', batch] });
      toast({
        title: enabled ? 'Preview turned on' : 'Preview turned off',
        description: enabled
          ? 'This batch now shows its contents on the main website.'
          : 'The Explore section is hidden for this batch on the main website.',
      });
    },
    onError: (e: Error) => toast({ title: 'Could not save', description: e.message, variant: 'destructive' }),
  });

  const toggleItem = useMutation({
    mutationFn: async ({ item, free }: { item: CatalogItem; free: boolean }) => {
      // Written to the SOURCE row. The catalog trigger mirrors it within the
      // same transaction, so the website sees the change on its next fetch.
      const { error } = await supabase
        .from(item.source_table)
        .update({ is_free_preview: free })
        .eq('id', item.source_id);
      if (error) throw error;
    },
    onMutate: async ({ item, free }) => {
      await queryClient.cancelQueries({ queryKey: ['catalog-items', batch] });
      const previous = queryClient.getQueryData<CatalogItem[]>(['catalog-items', batch]);
      queryClient.setQueryData<CatalogItem[]>(['catalog-items', batch], (old) =>
        (old ?? []).map((i) => (i.id === item.id ? { ...i, is_free_preview: free } : i)),
      );
      return { previous };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['catalog-items', batch], ctx.previous);
      toast({ title: 'Could not save', description: e.message, variant: 'destructive' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['catalog-items', batch] }),
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Free Preview
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Choose what people can open on unknowniitians.com before they buy. Titles are always
          visible when a batch's preview is on — only the items you switch on here actually play.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Batch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {batchesLoading ? (
            <Skeleton className="h-10 w-full max-w-md" />
          ) : (
            <Select value={batch} onValueChange={(v) => { setBatch(v); setSubject('all'); setSearch(''); }}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Select a batch" />
              </SelectTrigger>
              <SelectContent>
                {batches.map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {batch && (
            <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  {previewEnabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  Show this batch on the main website
                </div>
                <p className="text-sm text-muted-foreground">
                  {previewEnabled
                    ? 'Visitors see every subject, lecture and note title, all locked.'
                    : 'The Explore section is hidden entirely for this batch.'}
                </p>
              </div>
              <Switch
                checked={previewEnabled}
                disabled={toggleBatch.isPending}
                onCheckedChange={(v) => toggleBatch.mutate(v)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {batch && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex flex-wrap items-center gap-2">
              Items
              <Badge variant="secondary">{items.length} total</Badge>
              <Badge variant={freeCount > 0 ? 'default' : 'outline'}>{freeCount} free</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subjects</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search titles…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {itemsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : visible.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing matches that filter.
              </p>
            ) : (
              <div className="divide-y rounded-lg border">
                {visible.map((item) => {
                  const meta = TYPE_META[item.content_type];
                  const Icon = meta.icon;
                  return (
                    <div key={item.id} className="flex items-center gap-3 p-3">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.subject} · {meta.label}
                          {item.content_date ? ` · ${item.content_date}` : ''}
                        </p>
                      </div>
                      {item.is_free_preview && (
                        <Badge className="shrink-0" variant="default">Free</Badge>
                      )}
                      <Switch
                        checked={item.is_free_preview}
                        onCheckedChange={(v) => toggleItem.mutate({ item, free: v })}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
