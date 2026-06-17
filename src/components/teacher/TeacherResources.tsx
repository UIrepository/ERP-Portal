import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Filter, X, ExternalLink, FolderOpen } from 'lucide-react';
import { HugeiconsIcon } from '@hugeicons/react';
import { AssignmentsIcon, Crown02Icon, Note01Icon } from '@hugeicons/core-free-icons';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type ResourceType = 'DPP' | 'UI ki Padhai' | 'Notes';

interface ResourceItem {
  id: string;
  type: ResourceType;
  title: string;
  url: string;
  batch: string;
  subject: string;
  tag?: string; // difficulty / category / filename
  created_at: string;
}

// Per-type visual treatment for the card badge/icon (Hugeicons glyphs).
const TYPE_META: Record<ResourceType, { icon: typeof AssignmentsIcon; color: string; bg: string; border: string }> = {
  DPP: { icon: AssignmentsIcon, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
  'UI ki Padhai': { icon: Crown02Icon, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
  Notes: { icon: Note01Icon, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
};

const ResourceSkeleton = () => (
  <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="bg-white p-5 rounded-lg border border-slate-200 h-[150px] flex flex-col justify-between">
        <Skeleton className="h-4 w-20 rounded-sm" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    ))}
  </div>
);

export const TeacherResources = () => {
  const { user } = useAuth();

  const [selectedType, setSelectedType] = useState<'all' | ResourceType>('all');
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Teacher's assigned batch+subject combinations.
  const { data: teacherInfo } = useQuery({
    queryKey: ['teacherInfo', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('assigned_batches, assigned_subjects')
        .eq('user_id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const batches: string[] = teacherInfo?.assigned_batches || [];
  const subjects: string[] = teacherInfo?.assigned_subjects || [];

  // Fetch DPP + UI ki Padhai + Notes for the assigned combos, merged.
  const { data: resources, isLoading } = useQuery<ResourceItem[]>({
    queryKey: ['teacher-resources', batches, subjects],
    queryFn: async () => {
      if (!batches.length || !subjects.length) return [];

      const [dpp, uiki, notes] = await Promise.all([
        supabase.from('dpp_content')
          .select('id, title, link, difficulty, batch, subject, created_at')
          .in('batch', batches).in('subject', subjects).eq('is_active', true),
        supabase.from('ui_ki_padhai_content')
          .select('id, title, link, category, batch, subject, created_at')
          .in('batch', batches).in('subject', subjects).eq('is_active', true),
        supabase.from('notes')
          .select('id, title, file_url, filename, batch, subject, created_at')
          .in('batch', batches).in('subject', subjects),
      ]);

      const items: ResourceItem[] = [];
      (dpp.data || []).forEach((d: any) => items.push({
        id: d.id, type: 'DPP', title: d.title, url: d.link, batch: d.batch, subject: d.subject,
        tag: d.difficulty || undefined, created_at: d.created_at,
      }));
      (uiki.data || []).forEach((u: any) => items.push({
        id: u.id, type: 'UI ki Padhai', title: u.title, url: u.link, batch: u.batch, subject: u.subject,
        tag: u.category || undefined, created_at: u.created_at,
      }));
      (notes.data || []).forEach((n: any) => items.push({
        id: n.id, type: 'Notes', title: n.title, url: n.file_url, batch: n.batch, subject: n.subject,
        tag: n.filename || undefined, created_at: n.created_at,
      }));

      return items.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    },
    enabled: !!teacherInfo && batches.length > 0 && subjects.length > 0,
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    if (!resources) return [];
    const q = searchTerm.toLowerCase();
    return resources.filter((r) =>
      (selectedType === 'all' || r.type === selectedType) &&
      (selectedBatch === 'all' || r.batch === selectedBatch) &&
      (selectedSubject === 'all' || r.subject === selectedSubject) &&
      (!q || r.title.toLowerCase().includes(q)),
    );
  }, [resources, selectedType, selectedBatch, selectedSubject, searchTerm]);

  const counts = useMemo(() => {
    const c = { DPP: 0, 'UI ki Padhai': 0, Notes: 0 } as Record<ResourceType, number>;
    (resources || []).forEach((r) => { c[r.type] += 1; });
    return c;
  }, [resources]);

  const clearFilters = () => {
    setSelectedType('all');
    setSelectedBatch('all');
    setSelectedSubject('all');
    setSearchTerm('');
  };

  const hasFilters = selectedType !== 'all' || selectedBatch !== 'all' || selectedSubject !== 'all' || !!searchTerm;

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        {/* Header */}
        <div className="flex flex-col gap-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Resources</h1>
              <p className="text-sm text-slate-500 mt-1">
                DPP, UI Ki Padhai and Notes for your assigned batches &amp; subjects.
              </p>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search resources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm bg-white border-slate-200 focus:border-teal-500 focus:ring-teal-500"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 items-end md:items-center bg-slate-50 p-4 rounded-lg border border-slate-100">
            <div className="space-y-1.5 flex-1 w-full md:w-auto">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1"><Filter className="h-3 w-3" /> Type</label>
              <Select value={selectedType} onValueChange={(v) => setSelectedType(v as 'all' | ResourceType)}>
                <SelectTrigger className="bg-white h-9 border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="DPP">DPP ({counts.DPP})</SelectItem>
                  <SelectItem value="UI ki Padhai">UI Ki Padhai ({counts['UI ki Padhai']})</SelectItem>
                  <SelectItem value="Notes">Notes ({counts.Notes})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 flex-1 w-full md:w-auto">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1"><Filter className="h-3 w-3" /> Batch</label>
              <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                <SelectTrigger className="bg-white h-9 border-slate-200"><SelectValue placeholder="All Batches" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
                  {batches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 flex-1 w-full md:w-auto">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1"><Filter className="h-3 w-3" /> Subject</label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="bg-white h-9 border-slate-200"><SelectValue placeholder="All Subjects" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-3 text-slate-500 hover:text-slate-900 hover:bg-slate-200">
                <X className="h-4 w-4 mr-2" /> Clear
              </Button>
            )}
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <ResourceSkeleton />
        ) : filtered.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => {
              const meta = TYPE_META[r.type];
              return (
                <div
                  key={`${r.type}-${r.id}`}
                  onClick={() => window.open(r.url, '_blank')}
                  className="group relative bg-white border border-slate-200 rounded-lg p-5 flex flex-col gap-4 cursor-pointer hover:border-slate-900 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className={cn('inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm border w-fit', meta.bg, meta.color, meta.border)}>
                      <HugeiconsIcon icon={meta.icon} className="h-3.5 w-3.5" strokeWidth={2} />{r.type}
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0">{r.created_at ? format(new Date(r.created_at), 'dd MMM yyyy') : ''}</span>
                  </div>

                  <h3 className="font-semibold text-slate-900 text-base leading-snug line-clamp-2 min-h-[2.5rem]" title={r.title}>
                    {r.title}
                  </h3>

                  <div className="flex items-end justify-between gap-3 mt-auto pt-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-600 truncate">{r.subject}</p>
                      <p className="text-[11px] text-slate-400 truncate">{r.batch}{r.tag ? ` · ${r.tag}` : ''}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); window.open(r.url, '_blank'); }}
                      className="shrink-0 w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-700 hover:scale-105 transition-all"
                      aria-label="Open resource"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-lg border border-dashed border-slate-300">
            <div className="inline-block bg-slate-50 rounded-full p-3 mb-3">
              <FolderOpen className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">No Resources Found</h3>
            <p className="text-sm text-slate-500">
              {hasFilters ? 'Try adjusting your filters.' : 'No DPP, UI Ki Padhai or Notes for your assigned batches yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
