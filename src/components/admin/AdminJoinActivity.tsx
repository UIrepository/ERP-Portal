import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { istTodayStr } from '@/lib/timezone';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/StateScreens';
import {
  Calendar, ChevronLeft, ChevronRight, Users, MousePointerClick,
  ChevronDown, Clock, RefreshCw,
} from 'lucide-react';

interface JoinEvent {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  role: string | null;
  batch: string;
  subject: string;
  schedule_id: string | null;
  class_date: string;
  room_url: string | null;
  clicked_at: string;
}

const IST_OFFSET_MIN = 330;

const shiftDateStr = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// Render a timestamptz as an IST clock time (h:mm AM/PM).
const fmtClockIST = (ts: string): string => {
  const d = new Date(new Date(ts).getTime() + IST_OFFSET_MIN * 60000);
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
};

const fmtDateLabel = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
};

interface ClassGroup {
  key: string;
  batch: string;
  subject: string;
  uniqueStudents: number;
  totalClicks: number;
  firstClick: string;
  lastClick: string;
  students: {
    userId: string;
    name: string;
    email: string | null;
    firstClick: string;
    lastClick: string;
    clicks: number;
  }[];
}

/**
 * Admin-only "Join Activity" — for a chosen day, who clicked "Join" for each
 * class and when. Reads class_join_events (RLS restricts SELECT to admins).
 * Every student "Join Class" click writes one row; this rolls them up per class
 * and per student so an admin can see turnout and spot classes nobody entered.
 */
export const AdminJoinActivity = () => {
  const [date, setDate] = useState<string>(() => istTodayStr());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [batchFilter, setBatchFilter] = useState<string>('all');

  const today = istTodayStr();

  const { data: events = [], isLoading, isFetching, refetch } = useQuery<JoinEvent[]>({
    queryKey: ['admin-join-activity', date],
    queryFn: async () => {
      // Cast: class_join_events is newer than the generated Database types.
      const { data, error } = await (supabase.from('class_join_events' as never) as any)
        .select('*')
        .eq('class_date', date)
        .order('clicked_at', { ascending: true });
      if (error) throw error;
      return (data as JoinEvent[]) || [];
    },
    staleTime: 30_000,
  });

  const batches = useMemo(() => {
    const s = new Set<string>();
    events.forEach(e => s.add(e.batch));
    return Array.from(s).sort();
  }, [events]);

  const groups = useMemo<ClassGroup[]>(() => {
    const filtered = batchFilter === 'all' ? events : events.filter(e => e.batch === batchFilter);
    const byClass = new Map<string, JoinEvent[]>();
    filtered.forEach(e => {
      const k = `${e.batch}|||${e.subject}`;
      if (!byClass.has(k)) byClass.set(k, []);
      byClass.get(k)!.push(e);
    });

    const out: ClassGroup[] = [];
    byClass.forEach((rows, key) => {
      const [batch, subject] = key.split('|||');
      const byUser = new Map<string, JoinEvent[]>();
      rows.forEach(r => {
        if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
        byUser.get(r.user_id)!.push(r);
      });
      const students = Array.from(byUser, ([userId, urows]) => {
        const sorted = urows.slice().sort((a, b) => a.clicked_at.localeCompare(b.clicked_at));
        return {
          userId,
          name: sorted[0].user_name || sorted[0].user_email || 'Unknown',
          email: sorted[0].user_email,
          firstClick: sorted[0].clicked_at,
          lastClick: sorted[sorted.length - 1].clicked_at,
          clicks: sorted.length,
        };
      }).sort((a, b) => a.firstClick.localeCompare(b.firstClick));

      const allTimes = rows.map(r => r.clicked_at).sort();
      out.push({
        key,
        batch,
        subject,
        uniqueStudents: byUser.size,
        totalClicks: rows.length,
        firstClick: allTimes[0],
        lastClick: allTimes[allTimes.length - 1],
        students,
      });
    });
    return out.sort((a, b) => a.firstClick.localeCompare(b.firstClick));
  }, [events, batchFilter]);

  const totals = useMemo(() => {
    const src = batchFilter === 'all' ? events : events.filter(e => e.batch === batchFilter);
    const users = new Set(src.map(e => e.user_id));
    return { classes: groups.length, students: users.size, clicks: src.length };
  }, [events, groups, batchFilter]);

  const toggle = (k: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  return (
    <div className="w-full font-sans text-slate-900">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Join Activity</h1>
        <p className="text-sm text-slate-500 mt-1">
          Who clicked “Join” for each class, and when. Every student join tap is recorded here.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setDate(d => shiftDateStr(d, -1))}
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="inline-flex items-center gap-1.5 px-2">
            <Calendar className="h-4 w-4 text-violet-600" />
            <input
              type="date"
              value={date}
              max={today}
              onChange={e => e.target.value && setDate(e.target.value)}
              className="text-sm bg-transparent outline-none text-slate-900"
            />
          </div>
          <button
            type="button"
            onClick={() => setDate(d => (d < today ? shiftDateStr(d, 1) : d))}
            disabled={date >= today}
            className="p-1.5 rounded-md text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {date !== today && (
          <button
            type="button"
            onClick={() => setDate(today)}
            className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          >
            Today
          </button>
        )}

        {batches.length > 1 && (
          <select
            value={batchFilter}
            onChange={e => setBatchFilter(e.target.value)}
            className="text-sm rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 outline-none text-slate-700"
          >
            <option value="all">All batches</option>
            {batches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        )}

        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>

        <span className="ml-auto text-xs text-slate-400">{fmtDateLabel(date)}</span>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Classes</p>
          <p className="text-2xl font-semibold mt-1">{totals.classes}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Students joined</p>
          <p className="text-2xl font-semibold mt-1">{totals.students}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Total join taps</p>
          <p className="text-2xl font-semibold mt-1">{totals.clicks}</p>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      ) : groups.length === 0 ? (
        <div className="border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
          <EmptyState
            title="No join activity"
            subtitle={`No student clicked “Join” for any class on ${fmtDateLabel(date)}.`}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(g => {
            const isOpen = expanded.has(g.key);
            return (
              <div key={g.key} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(g.key)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-slate-900 truncate">{g.subject}</p>
                    <p className="text-[12px] text-slate-500 truncate">{g.batch}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="hidden sm:flex items-center gap-1.5 text-[12px] text-slate-500">
                      <Clock className="h-3.5 w-3.5" />
                      {fmtClockIST(g.firstClick)}
                      {g.firstClick !== g.lastClick && <>–{fmtClockIST(g.lastClick)}</>}
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 text-violet-700 px-2.5 py-1 text-[12px] font-semibold">
                      <Users className="h-3.5 w-3.5" />
                      {g.uniqueStudents}
                    </div>
                    <div className="hidden sm:inline-flex items-center gap-1.5 text-[12px] text-slate-500">
                      <MousePointerClick className="h-3.5 w-3.5" />
                      {g.totalClicks} taps
                    </div>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400">
                          <th className="font-semibold px-4 py-2">Student</th>
                          <th className="font-semibold px-4 py-2">First join</th>
                          <th className="font-semibold px-4 py-2 text-right">Taps</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.students.map(s => (
                          <tr key={s.userId} className="border-t border-slate-50">
                            <td className="px-4 py-2">
                              <p className="font-medium text-slate-800 leading-tight">{s.name}</p>
                              {s.email && s.email !== s.name && (
                                <p className="text-[11px] text-slate-400 leading-tight">{s.email}</p>
                              )}
                            </td>
                            <td className="px-4 py-2 text-slate-600">
                              {fmtClockIST(s.firstClick)}
                              {s.firstClick !== s.lastClick && (
                                <span className="text-slate-400"> · last {fmtClockIST(s.lastClick)}</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right text-slate-600">{s.clicks}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
