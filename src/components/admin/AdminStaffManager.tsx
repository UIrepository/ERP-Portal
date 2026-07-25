import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Loader2, Plus, Trash2, Shield, GraduationCap, Check, ChevronsUpDown, X, Pencil,
  Search, Users, BookOpen, Layers, Mail,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Role = 'teacher' | 'manager';
interface StaffMember {
  id: string; user_id: string | null; name: string; email: string;
  role: Role; batches: string[]; subjects: string[];
}

const initials = (name: string) =>
  (name || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

/* ---------------------------- MultiSelect ---------------------------- */
const MultiSelect = ({
  options, selected, onChange, placeholder, disabled, searchLabel,
}: {
  options: string[]; selected: string[]; onChange: (s: string[]) => void;
  placeholder?: string; disabled?: boolean; searchLabel?: string;
}) => {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((i) => i !== v) : [...selected, v]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex w-full items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left min-h-[42px] transition-colors',
            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100',
          )}
        >
          <div className="flex flex-1 flex-wrap gap-1">
            {selected.length === 0 && <span className="text-sm text-slate-400 py-0.5">{placeholder || 'Select…'}</span>}
            {selected.map((item) => (
              <span key={item} className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[12px] font-medium text-indigo-700">
                {item}
                <span
                  role="button"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onClick={(e) => { e.stopPropagation(); onChange(selected.filter((i) => i !== item)); }}
                  className="text-indigo-400 hover:text-indigo-700"
                >
                  <X className="h-3 w-3" />
                </span>
              </span>
            ))}
          </div>
          <ChevronsUpDown className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${searchLabel || 'options'}…`} />
          {/* CommandList scrolls natively (max-h + overflow-y-auto). Do NOT nest
              a Radix ScrollArea here — two scroll containers break scrolling. */}
          <CommandList className="max-h-60 overscroll-contain">
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem key={option} value={option} onSelect={() => toggle(option)} className="cursor-pointer">
                  <div className={cn(
                    'mr-2 flex h-4 w-4 items-center justify-center rounded border',
                    selected.includes(option) ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300',
                  )}>
                    {selected.includes(option) && <Check className="h-3 w-3" />}
                  </div>
                  <span className="text-sm">{option}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

/* ------------------------------ Chips ------------------------------- */
const ChipRow = ({ icon: Icon, items, tone }: { icon: any; items: string[]; tone: 'batch' | 'subject' }) => {
  if (!items || items.length === 0) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  const shown = items.slice(0, 3);
  const rest = items.length - shown.length;
  const cls = tone === 'batch' ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-700';
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
      {shown.map((it, i) => (
        <span key={i} className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-medium', cls)}>{it}</span>
      ))}
      {rest > 0 && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">+{rest}</span>}
    </div>
  );
};

/* ------------------------------ Main -------------------------------- */
export const AdminStaffManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<Role>('teacher');
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [originalSubjects, setOriginalSubjects] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toolbar
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Role>('all');

  const { data: staff, isLoading } = useQuery({
    queryKey: ['admin-staff'],
    queryFn: async (): Promise<StaffMember[]> => {
      const { data: teachers, error: tError } = await supabase.from('teachers').select('*');
      if (tError) throw tError;
      const { data: managers, error: mError } = await supabase.from('managers').select('*');
      if (mError) console.error('Error fetching managers:', mError);

      const t = (teachers || []).map((x) => ({
        id: x.id, user_id: x.user_id, name: x.name, email: x.email,
        role: 'teacher' as const, batches: x.assigned_batches || [], subjects: x.assigned_subjects || [],
      }));
      const m = (managers || []).map((x) => ({
        id: x.id, user_id: x.user_id, name: x.name, email: x.email,
        role: 'manager' as const, batches: x.assigned_batches || [], subjects: [] as string[],
      }));
      return [...t, ...m];
    },
  });

  // Comprehensive batch→subject options (enrollments + groups + schedules + recordings).
  const { data: rawEnrollments } = useQuery({
    queryKey: ['all-batch-subjects-staff'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_all_batch_subjects' as any);
      if (error) { console.error('Error fetching batch/subjects', error); return [] as { batch_name: string; subject_name: string }[]; }
      return (data || []) as { batch_name: string; subject_name: string }[];
    },
  });

  const uniqueBatches = useMemo(
    () => Array.from(new Set((rawEnrollments || []).map((e) => e.batch_name).filter(Boolean))).sort(),
    [rawEnrollments],
  );

  // Subjects filtered dynamically by the batches picked in the form.
  const availableSubjects = useMemo(() => {
    if (selectedBatches.length === 0 || !rawEnrollments) return [];
    const opts = new Set(
      rawEnrollments
        .filter((e) => e.batch_name && selectedBatches.includes(e.batch_name) && e.subject_name)
        .map((e) => `${e.subject_name} (${e.batch_name})`),
    );
    return Array.from(opts).sort();
  }, [selectedBatches, rawEnrollments]);

  const filteredStaff = useMemo(() => {
    let list = staff || [];
    if (roleFilter !== 'all') list = list.filter((s) => s.role === roleFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
    return list;
  }, [staff, roleFilter, search]);

  const counts = useMemo(() => ({
    teachers: (staff || []).filter((s) => s.role === 'teacher').length,
    managers: (staff || []).filter((s) => s.role === 'manager').length,
  }), [staff]);

  const handleSaveStaff = async () => {
    if (!newStaffName || !newStaffEmail) {
      toast({ title: 'Missing fields', description: 'Name and email are required.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const subjectsToSave = newStaffRole === 'teacher'
        ? Array.from(new Set(selectedSubjects.map((s) => s.replace(/\s*\(.*?\)\s*$/, '').trim())))
        : [];
      const availableCleaned = new Set(availableSubjects.map((o) => o.replace(/\s*\(.*?\)\s*$/, '').trim()));
      const preserved = (newStaffRole === 'teacher' && editingId)
        ? originalSubjects.filter((s) => s && !availableCleaned.has(s)) : [];
      const finalSubjects = Array.from(new Set([...subjectsToSave, ...preserved]));

      if (editingId) {
        if (newStaffRole === 'teacher') {
          const { error } = await supabase.from('teachers').update({
            name: newStaffName, assigned_batches: selectedBatches, assigned_subjects: finalSubjects,
          }).eq('id', editingId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('managers').update({
            name: newStaffName, assigned_batches: selectedBatches,
          }).eq('id', editingId);
          if (error) throw error;
        }
        toast({ title: 'Updated', description: 'Staff details saved.' });
      } else {
        if (newStaffRole === 'teacher') {
          const { error } = await supabase.from('teachers').insert({
            name: newStaffName, email: newStaffEmail, assigned_batches: selectedBatches, assigned_subjects: finalSubjects,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase.from('managers').insert({
            name: newStaffName, email: newStaffEmail, assigned_batches: selectedBatches,
          });
          if (error) throw error;
        }
        toast({ title: 'Added', description: `${newStaffRole} created.` });
      }
      setIsDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, role: Role) => {
    if (!confirm('Remove this staff member? This cannot be undone.')) return;
    setIsDeleting(id);
    try {
      await supabase.from(role === 'teacher' ? 'teachers' : 'managers').delete().eq('id', id);
      toast({ title: 'Removed', description: 'Staff member deleted.' });
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleEditClick = (member: StaffMember) => {
    setEditingId(member.id);
    setNewStaffName(member.name);
    setNewStaffEmail(member.email);
    setNewStaffRole(member.role);
    const batches = member.batches || [];
    setSelectedBatches(batches);
    setOriginalSubjects(member.role === 'teacher' ? (member.subjects || []) : []);

    let hydrated: string[] = [];
    if (member.role === 'teacher' && rawEnrollments && member.subjects) {
      const db = member.subjects;
      rawEnrollments.forEach((e) => {
        if (e.batch_name && e.subject_name && batches.includes(e.batch_name) && db.includes(e.subject_name)) {
          hydrated.push(`${e.subject_name} (${e.batch_name})`);
        }
      });
      hydrated = Array.from(new Set(hydrated));
    }
    setSelectedSubjects(hydrated);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingId(null); setNewStaffName(''); setNewStaffEmail(''); setNewStaffRole('teacher');
    setSelectedBatches([]); setSelectedSubjects([]); setOriginalSubjects([]);
  };
  const openAddDialog = () => { resetForm(); setIsDialogOpen(true); };

  return (
    <div className="p-4 sm:p-6 max-w-[1200px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Staff Management</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage teacher and manager access, batches and subjects.</p>
        </div>
        <Button onClick={openAddDialog} className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 w-full sm:w-auto">
          <Plus className="mr-1.5 h-4 w-4" /> Add staff
        </Button>
      </div>

      {/* Toolbar: counts + search + role filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-2.5 py-1.5 text-[13px] font-medium text-slate-700">
            <GraduationCap className="h-4 w-4 text-indigo-500" /> {counts.teachers} teacher{counts.teachers !== 1 ? 's' : ''}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-2.5 py-1.5 text-[13px] font-medium text-slate-700">
            <Shield className="h-4 w-4 text-amber-500" /> {counts.managers} manager{counts.managers !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="pl-8 h-9 w-full sm:w-60"
            />
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-[13px]">
            {(['all', 'teacher', 'manager'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={cn(
                  'px-3 py-1.5 rounded-md font-medium capitalize transition-colors',
                  roleFilter === r ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {r === 'all' ? 'All' : `${r}s`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : filteredStaff.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
          <Users className="h-8 w-8 text-slate-300 mx-auto" />
          <p className="mt-2 text-sm font-medium text-slate-600">No staff found</p>
          <p className="text-xs text-slate-400">{search || roleFilter !== 'all' ? 'Try a different search or filter.' : 'Add your first staff member.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredStaff.map((member) => (
            <div key={member.id} className="group relative rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-200 hover:shadow-sm transition-all">
              <div className="flex items-start gap-3">
                <div className={cn(
                  'grid h-11 w-11 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white',
                  member.role === 'manager' ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-gradient-to-br from-indigo-400 to-indigo-600',
                )}>
                  {initials(member.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-[15px] font-semibold text-slate-900">{member.name}</h3>
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      member.role === 'manager' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700',
                    )}>
                      {member.role === 'manager' ? <Shield className="h-3 w-3" /> : <GraduationCap className="h-3 w-3" />}
                      {member.role}
                    </span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                    <Mail className="h-3 w-3 shrink-0" /> {member.email}
                  </p>
                </div>
                {/* actions */}
                <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                  <button onClick={() => handleEditClick(member)} title="Edit" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-indigo-50 hover:text-indigo-600">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(member.id, member.role)} disabled={isDeleting === member.id} title="Remove" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                    {isDeleting === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                <ChipRow icon={Layers} items={member.batches} tone="batch" />
                {member.role === 'teacher' && <ChipRow icon={BookOpen} items={member.subjects} tone="subject" />}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit staff member' : 'Add staff member'}</DialogTitle>
            <DialogDescription>Assign batches, then pick subjects available within those batches.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-slate-700">Name</label>
                <Input value={newStaffName} onChange={(e) => setNewStaffName(e.target.value)} placeholder="Full name" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-slate-700">Role</label>
                <div className="inline-flex w-full rounded-lg border border-slate-200 bg-white p-0.5">
                  {(['teacher', 'manager'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      disabled={!!editingId}
                      onClick={() => { setNewStaffRole(r); if (r === 'manager') setSelectedSubjects([]); }}
                      className={cn(
                        'flex-1 rounded-md py-1.5 text-[13px] font-medium capitalize transition-colors',
                        newStaffRole === r ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900',
                        editingId && 'opacity-60 cursor-not-allowed',
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-slate-700">Email</label>
              <Input value={newStaffEmail} onChange={(e) => setNewStaffEmail(e.target.value)} placeholder="name@example.com" disabled={!!editingId} />
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-slate-700">Assigned batches</label>
              <MultiSelect
                options={uniqueBatches}
                selected={selectedBatches}
                onChange={(b) => {
                  setSelectedBatches(b);
                  // Drop any picked subjects whose batch is no longer selected.
                  setSelectedSubjects((prev) => prev.filter((s) => {
                    const m = s.match(/\(([^)]*)\)\s*$/);
                    return m ? b.includes(m[1]) : true;
                  }));
                }}
                placeholder="Select batches…"
                searchLabel="batches"
              />
            </div>

            {newStaffRole === 'teacher' && (
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-slate-700">
                  Assigned subjects <span className="font-normal text-slate-400">· filtered by batch</span>
                </label>
                <MultiSelect
                  options={availableSubjects}
                  selected={selectedSubjects}
                  onChange={setSelectedSubjects}
                  placeholder={selectedBatches.length > 0 ? 'Select subjects…' : 'Select a batch first'}
                  disabled={selectedBatches.length === 0}
                  searchLabel="subjects"
                />
                {selectedBatches.length === 0 && (
                  <p className="text-[11px] text-slate-400">Pick a batch above to see its subjects.</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveStaff} disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? 'Save changes' : 'Create account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
