import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Megaphone, Send, Users, Loader2, Check, Search, Trash2, GraduationCap, History, UserCircle,
} from 'lucide-react';

interface TeacherRow {
  id: string;
  user_id: string | null;
  name: string | null;
  email: string | null;
}

interface NotifRow {
  id: string;
  title: string;
  message: string;
  created_at: string;
  created_by_name: string | null;
  target_user_id: string | null;
}

// One announcement = several notification rows (one per teacher) that share the
// same insert timestamp. Group them back into a single card.
interface AnnouncementGroup {
  key: string;
  title: string;
  message: string;
  created_at: string;
  created_by_name: string | null;
  ids: string[];
  recipientIds: string[];
}

// Draft persists across tab switches (the component unmounts when you leave the
// tab, which would otherwise wipe the typed announcement).
const DRAFT_KEY = 'ui-draft-teacher-announcement';
const loadDraft = (): { title?: string; message?: string; allTeachers?: boolean; selected?: string[] } => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch { return {}; }
};

export const AdminTeacherAnnouncement = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [draft] = useState(loadDraft);
  const [title, setTitle] = useState(draft.title || '');
  const [message, setMessage] = useState(draft.message || '');
  const [allTeachers, setAllTeachers] = useState(draft.allTeachers ?? true);
  const [selected, setSelected] = useState<Set<string>>(new Set(draft.selected || [])); // teacher user_ids
  const [search, setSearch] = useState('');

  // Save the draft whenever the composed content changes; clear it once empty.
  useEffect(() => {
    if (!title && !message && selected.size === 0 && allTeachers) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, message, allTeachers, selected: Array.from(selected) }));
  }, [title, message, allTeachers, selected]);

  const { data: teachers = [], isLoading: teachersLoading } = useQuery({
    queryKey: ['teachers-for-announcements'],
    queryFn: async (): Promise<TeacherRow[]> => {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, user_id, name, email')
        .order('name');
      if (error) throw error;
      return (data || []) as TeacherRow[];
    },
  });

  const teacherName = useMemo(() => {
    const m = new Map<string, string>();
    teachers.forEach((t) => { if (t.user_id) m.set(t.user_id, t.name || t.email || 'Teacher'); });
    return m;
  }, [teachers]);

  const activeTeacherIds = useMemo(
    () => teachers.filter((t) => t.user_id).map((t) => t.user_id as string),
    [teachers],
  );

  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter(
      (t) => (t.name || '').toLowerCase().includes(q) || (t.email || '').toLowerCase().includes(q),
    );
  }, [teachers, search]);

  const toggleTeacher = (userId: string | null) => {
    if (!userId) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  // ---- History (grouped) ----
  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['teacher-announcements-history'],
    queryFn: async (): Promise<AnnouncementGroup[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, message, created_at, created_by_name, target_user_id')
        .eq('target_role', 'teacher')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;

      const groups = new Map<string, AnnouncementGroup>();
      (data as NotifRow[] | null)?.forEach((r) => {
        const key = `${r.created_at}|${r.title}|${r.message}`;
        const g = groups.get(key);
        if (g) {
          g.ids.push(r.id);
          if (r.target_user_id) g.recipientIds.push(r.target_user_id);
        } else {
          groups.set(key, {
            key,
            title: r.title,
            message: r.message,
            created_at: r.created_at,
            created_by_name: r.created_by_name,
            ids: [r.id],
            recipientIds: r.target_user_id ? [r.target_user_id] : [],
          });
        }
      });
      return Array.from(groups.values());
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const recipientIds = allTeachers
        ? activeTeacherIds
        : activeTeacherIds.filter((id) => selected.has(id));

      if (recipientIds.length === 0) {
        throw new Error('Select at least one teacher with an active account.');
      }

      const rows = recipientIds.map((uid) => ({
        title: title.trim(),
        message: message.trim(),
        target_role: 'teacher' as const,
        target_user_id: uid,
        target_batch: null,
        target_subject: null,
        created_by: profile?.user_id ?? null,
        created_by_name: profile?.name ?? 'Admin',
        is_active: true,
      }));

      const { error } = await supabase.from('notifications').insert(rows);
      if (error) throw error;

      // Push + email (both best-effort — neither blocks the announcement itself).
      const [pushRes, emailRes] = await Promise.allSettled([
        supabase.functions.invoke('send-push', {
          body: {
            title: title.trim(),
            body: message.trim(),
            user_ids: recipientIds,
            tag: 'teacher-announcement',
          },
        }),
        supabase.functions.invoke('send-teacher-announcement-email', {
          body: { title: title.trim(), message: message.trim(), user_ids: recipientIds },
        }),
      ]);
      if (pushRes.status === 'rejected' || (pushRes.value as any)?.error) {
        console.warn('Teacher announcement push failed:', pushRes);
      }
      if (emailRes.status === 'rejected' || (emailRes.value as any)?.error) {
        console.warn('Teacher announcement email failed:', emailRes);
      }

      return recipientIds.length;
    },
    onSuccess: (count) => {
      toast({ title: 'Announcement sent', description: `Delivered to ${count} teacher${count === 1 ? '' : 's'} (in-app, push & email).` });
      setTitle('');
      setMessage('');
      setSelected(new Set());
      setAllTeachers(true);
      localStorage.removeItem(DRAFT_KEY);
      queryClient.invalidateQueries({ queryKey: ['teacher-announcements-history'] });
    },
    onError: (e: unknown) => {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed to send', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('notifications').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Deleted', description: 'Announcement removed.' });
      queryClient.invalidateQueries({ queryKey: ['teacher-announcements-history'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const handleSend = () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: 'Missing fields', description: 'Title and message are required.', variant: 'destructive' });
      return;
    }
    sendMutation.mutate();
  };

  const selectedCount = allTeachers ? activeTeacherIds.length : activeTeacherIds.filter((id) => selected.has(id)).length;

  return (
    <div className="p-4 md:p-6 space-y-8 bg-slate-50 min-h-full animate-fade-in-up">
      <div className="flex flex-col space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Teacher Broadcast</h1>
        <p className="text-slate-500">Send an announcement to teachers. They receive it in-app, as a push notification, and by email.</p>
      </div>

      {/* Compose */}
      <Card className="shadow-lg rounded-2xl border-slate-200">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Megaphone className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Compose Message</CardTitle>
              <CardDescription>This goes only to teachers — never to students.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          <div className="space-y-2">
            <label className="font-medium text-slate-700">Title</label>
            <Input placeholder="E.g., Staff meeting moved to 5 PM" value={title} onChange={(e) => setTitle(e.target.value)} className="text-base" />
          </div>
          <div className="space-y-2">
            <label className="font-medium text-slate-700">Message</label>
            <Textarea placeholder="Full announcement details…" value={message} onChange={(e) => setMessage(e.target.value)} rows={6} className="text-base" />
          </div>
        </CardContent>
      </Card>

      {/* Audience */}
      <Card className="shadow-lg rounded-2xl border-slate-200">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Audience</CardTitle>
              <CardDescription>All teachers, or pick specific ones.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2 space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
            <div>
              <p className="font-medium text-slate-800">All teachers</p>
              <p className="text-xs text-slate-500">Send to every teacher with an active account ({activeTeacherIds.length}).</p>
            </div>
            <Switch checked={allTeachers} onCheckedChange={setAllTeachers} />
          </div>

          {!allTeachers && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="Search teachers…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <ScrollArea className="h-64">
                  {teachersLoading ? (
                    <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                  ) : filteredTeachers.length === 0 ? (
                    <p className="p-6 text-center text-sm text-slate-400">No teachers found.</p>
                  ) : (
                    filteredTeachers.map((t) => {
                      const disabled = !t.user_id;
                      const isSel = !!t.user_id && selected.has(t.user_id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleTeacher(t.user_id)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-b last:border-0 transition-colors ${
                            disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'
                          } ${isSel ? 'bg-primary/5' : ''}`}
                        >
                          <span className={`flex h-5 w-5 items-center justify-center rounded border ${isSel ? 'bg-primary border-primary text-white' : 'border-slate-300'}`}>
                            {isSel && <Check className="h-3.5 w-3.5" />}
                          </span>
                          <GraduationCap className="h-4 w-4 text-slate-400 shrink-0" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-slate-800 truncate">{t.name || 'Unnamed'}</span>
                            <span className="block text-xs text-slate-400 truncate">{t.email}{disabled ? ' • not activated yet' : ''}</span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </ScrollArea>
              </div>
            </div>
          )}

          <Separator />
          <p className="text-sm text-slate-600">
            Recipients: <strong>{selectedCount}</strong> teacher{selectedCount === 1 ? '' : 's'}
            {allTeachers ? ' (all)' : ''}
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSend} disabled={sendMutation.isPending} size="lg" className="w-full md:w-auto font-semibold">
          {sendMutation.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
          {sendMutation.isPending ? 'Sending…' : 'Send to Teachers'}
        </Button>
      </div>

      {/* History */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2"><History className="h-5 w-5 text-primary" /> Sent to Teachers</h2>
        {historyLoading ? (
          <div className="space-y-4">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
        ) : history.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed">
            <Megaphone className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No teacher announcements yet.</p>
          </div>
        ) : (
          history.map((g) => {
            const isAll = g.recipientIds.length >= activeTeacherIds.length && activeTeacherIds.length > 0;
            const names = g.recipientIds.map((id) => teacherName.get(id) || 'Teacher');
            return (
              <Card key={g.key} className="bg-white shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="bg-slate-50 p-4 border-b flex flex-row justify-between items-center gap-3">
                  <CardTitle className="text-base font-semibold text-slate-800">{g.title}</CardTitle>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this announcement?</AlertDialogTitle>
                        <AlertDialogDescription>It will be removed for all {g.ids.length} recipient(s). This cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(g.ids)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardHeader>
                <CardContent className="p-4">
                  <p className="text-slate-700 whitespace-pre-wrap text-sm leading-relaxed">{g.message}</p>
                </CardContent>
                <div className="bg-slate-50 px-4 py-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><UserCircle className="h-3.5 w-3.5" /> {g.created_by_name || 'Admin'} • {format(new Date(g.created_at), 'PPP, p')}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {isAll ? (
                      <Badge variant="secondary">All teachers ({g.recipientIds.length})</Badge>
                    ) : (
                      <>
                        {names.slice(0, 4).map((n, i) => <Badge key={i} variant="outline">{n}</Badge>)}
                        {names.length > 4 && <Badge variant="outline">+{names.length - 4}</Badge>}
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};
