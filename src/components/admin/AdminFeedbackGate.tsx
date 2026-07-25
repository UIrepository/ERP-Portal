import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import { Loader2, Search, Check, ChevronDown, ChevronRight, ShieldAlert, X } from 'lucide-react';

interface Target { batch: string; subject: string | null }
interface GateConfig {
  enabled: boolean;
  scope: 'everywhere' | 'active_batch';
  targets: Target[];
  activated_at: string | null;
}

const wholeKey = (b: string) => `${b}::*`;
const subjKey = (b: string, s: string) => `${b}::${s}`;

export const AdminFeedbackGate = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [enabled, setEnabled] = useState(false);
  const [scope, setScope] = useState<'everywhere' | 'active_batch'>('everywhere');
  const [targets, setTargets] = useState<Target[]>([]);
  const [reactivate, setReactivate] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: config, isLoading: loadingConfig } = useQuery<GateConfig>({
    queryKey: ['feedback-gate-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback_gate')
        .select('enabled, scope, targets, activated_at')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      return (data || { enabled: false, scope: 'everywhere', targets: [], activated_at: null }) as GateConfig;
    },
  });

  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setScope(config.scope || 'everywhere');
      setTargets(Array.isArray(config.targets) ? config.targets : []);
    }
  }, [config]);

  const { data: options = [], isLoading: loadingOptions } = useQuery<{ batch_name: string; subject_name: string }[]>({
    queryKey: ['all-batch-subjects'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_batch_subjects');
      if (error) throw error;
      return data || [];
    },
  });

  // batch -> sorted unique subjects
  const batchMap = useMemo(() => {
    const m = new Map<string, Set<string>>();
    options.forEach((o) => {
      if (!o.batch_name) return;
      if (!m.has(o.batch_name)) m.set(o.batch_name, new Set());
      if (o.subject_name && o.subject_name !== 'No subjects') m.get(o.batch_name)!.add(o.subject_name);
    });
    return m;
  }, [options]);

  const filteredBatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...batchMap.keys()]
      .filter((b) => !q || b.toLowerCase().includes(q))
      .sort((a, b) => a.localeCompare(b));
  }, [batchMap, search]);

  const selected = useMemo(() => {
    const set = new Set<string>();
    targets.forEach((t) => set.add(t.subject === null ? wholeKey(t.batch) : subjKey(t.batch, t.subject)));
    return set;
  }, [targets]);

  const isWholeBatch = (b: string) => selected.has(wholeKey(b));
  const isSubject = (b: string, s: string) => selected.has(subjKey(b, s));

  const toggleWholeBatch = (b: string) => {
    setTargets((prev) => {
      if (isWholeBatch(b)) return prev.filter((t) => !(t.batch === b && t.subject === null));
      // whole batch supersedes any specific-subject rows for this batch
      const cleaned = prev.filter((t) => t.batch !== b);
      return [...cleaned, { batch: b, subject: null }];
    });
  };

  const toggleSubject = (b: string, s: string) => {
    setTargets((prev) => {
      // if whole batch is on, switching to specific subjects removes the whole-batch row
      const withoutWhole = prev.filter((t) => !(t.batch === b && t.subject === null));
      if (isSubject(b, s)) return withoutWhole.filter((t) => !(t.batch === b && t.subject === s));
      return [...withoutWhole, { batch: b, subject: s }];
    });
  };

  const toggleExpand = (b: string) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      n.has(b) ? n.delete(b) : n.add(b);
      return n;
    });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (enabled && targets.length === 0) throw new Error('Pick at least one batch or subject to target.');
      // Set/refresh the activation time when turning the gate on, or when the
      // admin explicitly restarts the round. Students must submit feedback dated
      // after activated_at to pass.
      const turningOn = enabled && (!config?.enabled || !config?.activated_at);
      const activated_at =
        enabled && (turningOn || reactivate) ? new Date().toISOString() : config?.activated_at ?? null;
      const { error } = await supabase
        .from('feedback_gate')
        .update({
          enabled,
          scope,
          targets,
          activated_at,
          updated_by: profile?.user_id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1);
      if (error) throw error;
    },
    onSuccess: () => {
      setReactivate(false);
      queryClient.invalidateQueries({ queryKey: ['feedback-gate-config'] });
      toast({ title: 'Saved', description: enabled ? 'Feedback gate is live.' : 'Feedback gate turned off.' });
    },
    onError: (e: any) => toast({ title: 'Could not save', description: e.message, variant: 'destructive' }),
  });

  const dirty =
    !!config &&
    (enabled !== config.enabled ||
      scope !== (config.scope || 'everywhere') ||
      JSON.stringify(targets) !== JSON.stringify(config.targets || []) ||
      reactivate);

  const totalSelected = targets.length;

  if (loadingConfig) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="max-w-[1000px] mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ShieldAlert className="h-6 w-6 text-indigo-600" /> Feedback Gate
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Force selected students to submit feedback before they can use the portal. They complete every targeted
          subject one by one, then the app unlocks.
        </p>
      </div>

      {/* Status */}
      <Card className="border-slate-200 shadow-none p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-slate-900">Gate {enabled ? 'enabled' : 'disabled'}</p>
            <p className="text-sm text-slate-500 mt-0.5">
              {config?.enabled && config.activated_at
                ? `Live since ${new Date(config.activated_at).toLocaleString()}`
                : 'Turn on to start blocking targeted students.'}
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        {enabled && (
          <div className="mt-5 pt-5 border-t border-slate-100 space-y-5">
            {/* Scope */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">When should it show?</p>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                {([
                  ['everywhere', 'Everywhere (ignore batch switch)'],
                  ['active_batch', 'Only when they are in that batch'],
                ] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setScope(val)}
                    className={`px-3 py-1.5 text-[13px] rounded-md transition-colors ${
                      scope === val ? 'bg-white shadow-sm text-slate-900 font-medium' : 'text-slate-500'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {config?.enabled && (
              <div className="flex items-center gap-3">
                <Button
                  variant={reactivate ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setReactivate((v) => !v)}
                  className={reactivate ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
                >
                  {reactivate ? <Check className="h-4 w-4 mr-1.5" /> : null}
                  Re-collect fresh feedback (restart round)
                </Button>
                {reactivate && (
                  <span className="text-xs text-slate-500">Everyone will be asked again on save.</span>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Targets */}
      {enabled && (
        <Card className="border-slate-200 shadow-none p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold text-slate-900">Who gets the gate</p>
              <p className="text-sm text-slate-500 mt-0.5">Pick whole batches, or expand to target specific subjects.</p>
            </div>
            <Badge variant="secondary">{totalSelected} selected</Badge>
          </div>

          {/* selected chips */}
          {targets.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {targets.map((t, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[12px] bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full pl-2.5 pr-1.5 py-0.5">
                  {t.batch.trim()}{t.subject ? ` · ${t.subject}` : ' · whole batch'}
                  <button
                    onClick={() => setTargets((prev) => prev.filter((x) => !(x.batch === t.batch && x.subject === t.subject)))}
                    className="hover:bg-indigo-100 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="relative mb-2">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search batches" className="pl-9 h-9" />
          </div>

          {loadingOptions ? (
            <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" /></div>
          ) : (
            <ScrollArea className="h-[360px] border border-slate-100 rounded-lg">
              <div className="divide-y divide-slate-100">
                {filteredBatches.map((b) => {
                  const subjects = [...(batchMap.get(b) || [])].sort((x, y) => x.localeCompare(y));
                  const whole = isWholeBatch(b);
                  const isOpen = expanded.has(b);
                  return (
                    <div key={b}>
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <button
                          onClick={() => toggleWholeBatch(b)}
                          className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${
                            whole ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 hover:border-indigo-400'
                          }`}
                          title="Target the whole batch"
                        >
                          {whole && <Check className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => toggleExpand(b)} className="flex-1 min-w-0 flex items-center gap-1.5 text-left">
                          {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
                          <span className="truncate text-[14px] text-slate-800">{b.trim()}</span>
                          <span className="text-[11px] text-slate-400 shrink-0">{subjects.length} subj</span>
                        </button>
                        {whole && <Badge variant="secondary" className="text-[10px]">whole batch</Badge>}
                      </div>
                      {isOpen && subjects.length > 0 && (
                        <div className="pl-10 pr-3 pb-2.5 flex flex-wrap gap-1.5">
                          {subjects.map((s) => {
                            const on = whole || isSubject(b, s);
                            return (
                              <button
                                key={s}
                                disabled={whole}
                                onClick={() => toggleSubject(b, s)}
                                className={`text-[12px] px-2.5 py-1 rounded-full border transition-colors ${
                                  on
                                    ? 'bg-indigo-600 border-indigo-600 text-white'
                                    : 'border-slate-200 text-slate-600 hover:border-indigo-300'
                                } ${whole ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                {s}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </Card>
      )}

      {/* Save bar */}
      <div className="flex items-center justify-end gap-3 sticky bottom-0 bg-white/80 backdrop-blur py-3 border-t border-slate-100">
        {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !dirty}
          className="bg-slate-900 hover:bg-slate-800 text-white px-6"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
        </Button>
      </div>
    </div>
  );
};
