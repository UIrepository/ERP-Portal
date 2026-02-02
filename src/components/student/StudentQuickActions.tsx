import { Video, Clock, Megaphone } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, getDay, isToday, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface StudentQuickActionsProps {
  batch: string | null;
  subjects: string[];
}

interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  date?: string;
}

export const StudentQuickActions = ({ batch, subjects }: StudentQuickActionsProps) => {
  const { profile } = useAuth();
  const today = new Date();
  const currentDayOfWeek = getDay(today);
  const currentTimeStr = format(today, 'HH:mm:ss');

  // Fetch today's classes
  const { data: todayClasses, isLoading } = useQuery<Schedule[]>({
    queryKey: ['quickActionClasses', batch, subjects, currentDayOfWeek],
    queryFn: async () => {
      if (!batch || subjects.length === 0) return [];
      
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('batch', batch)
        .in('subject', subjects)
        .or(`day_of_week.eq.${currentDayOfWeek},date.eq.${format(today, 'yyyy-MM-dd')}`);
      
      if (error) return [];
      
      // Filter to only today's classes
      return (data || []).filter(schedule => {
        if (schedule.date) {
          return isToday(parseISO(schedule.date));
        }
        return schedule.day_of_week === currentDayOfWeek;
      });
    },
    enabled: !!batch && subjects.length > 0,
  });

  // Find ongoing class
  const ongoingClass = todayClasses?.find(c => {
    const start = c.start_time;
    const end = c.end_time;
    return currentTimeStr >= start && currentTimeStr <= end;
  });

  // Find next upcoming class
  const upcomingClasses = todayClasses
    ?.filter(c => c.start_time > currentTimeStr)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const nextClass = upcomingClasses?.[0];

  // Fetch recent announcement count
  const { data: announcementCount } = useQuery({
    queryKey: ['quickActionAnnouncements', batch],
    queryFn: async () => {
      if (!batch) return 0;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterday.toISOString())
        .eq('is_active', true);
      
      return count || 0;
    },
    enabled: !!batch,
  });

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Ongoing Class */}
      <div className={`p-5 rounded-xl border transition-all ${
        ongoingClass 
          ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-transparent shadow-lg' 
          : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            ongoingClass ? 'bg-white/20' : 'bg-emerald-100'
          }`}>
            <Video className={`h-5 w-5 ${ongoingClass ? 'text-white' : 'text-emerald-600'}`} />
          </div>
          <div>
            <p className={`text-sm font-medium ${ongoingClass ? 'text-emerald-100' : 'text-slate-500'}`}>
              {ongoingClass ? 'LIVE NOW' : 'No Class Right Now'}
            </p>
            <p className={`font-semibold ${ongoingClass ? 'text-white' : 'text-slate-700'}`}>
              {ongoingClass ? ongoingClass.subject : 'You\'re free!'}
            </p>
          </div>
        </div>
      </div>

      {/* Next Class */}
      <div className="p-5 rounded-xl bg-white border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Clock className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">
              {nextClass ? 'Next Class' : 'No More Classes Today'}
            </p>
            <p className="font-semibold text-slate-700">
              {nextClass ? `${nextClass.subject} at ${formatTime(nextClass.start_time)}` : 'All done for today!'}
            </p>
          </div>
        </div>
      </div>

      {/* Announcements */}
      <div className="p-5 rounded-xl bg-white border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center relative">
            <Megaphone className="h-5 w-5 text-rose-600" />
            {(announcementCount || 0) > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {announcementCount}
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Recent Updates</p>
            <p className="font-semibold text-slate-700">
              {(announcementCount || 0) > 0 
                ? `${announcementCount} new announcement${announcementCount > 1 ? 's' : ''}`
                : 'No new updates'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
