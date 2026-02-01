import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Video, Loader2 } from 'lucide-react';
import { format, isToday, parse } from 'date-fns';
import { toast } from 'sonner';

interface Schedule {
  id: string;
  subject: string;
  batch: string;
  start_time: string;
  end_time: string;
  date: string | null;
  day_of_week: number;
}

export const StudentJoinClass = () => {
  const { profile, user } = useAuth();
  const [activeBatchSubjects, setActiveBatchSubjects] = useState<Set<string>>(new Set());

  // 1. Fetch My Enrollments (with IDs for the secure link)
  const { data: enrollments } = useQuery({
    queryKey: ['studentEnrollments', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('user_enrollments').select('id, batch_name, subject_name').eq('user_id', user?.id);
      return data || [];
    },
    enabled: !!user?.id
  });

  // 2. Fetch Schedule
  const { data: schedules, isLoading } = useQuery({
    queryKey: ['studentSchedule'],
    queryFn: async () => {
       const { data } = await supabase.from('schedules').select('*');
       return data || [];
    }
  });

  // 3. Filter Today's Classes
  const todaysClasses = schedules?.filter(s => {
      if (!enrollments) return false;
      const isEnrolled = enrollments.some(e => e.batch_name === s.batch && e.subject_name === s.subject);
      const isTime = s.date ? isToday(new Date(s.date)) : (new Date().getDay() === s.day_of_week);
      return isEnrolled && isTime;
  }) || [];

  // 4. POLL for "Is Teacher Live?"
  useEffect(() => {
    if (todaysClasses.length === 0 || !enrollments) return;

    const checkActiveStatus = async () => {
        const myBatches = enrollments.map(e => e.batch_name);
        if (myBatches.length === 0) return;

        const { data } = await supabase
            .from('active_classes')
            .select('batch, subject')
            .in('batch', myBatches)
            .eq('is_active', true);
        
        const activeSet = new Set<string>();
        data?.forEach(row => activeSet.add(`${row.batch}|${row.subject}`));
        setActiveBatchSubjects(activeSet);
    };

    checkActiveStatus(); // Check now
    const interval = setInterval(checkActiveStatus, 5000); // Check every 5s
    return () => clearInterval(interval);
  }, [enrollments, todaysClasses]);

  const handleJoin = (cls: Schedule) => {
      const enrollment = enrollments?.find(e => e.batch_name === cls.batch && e.subject_name === cls.subject);
      
      if (enrollment?.id) {
          // SECURE LINK: /class-session/<UUID>
          // OPEN IN NEW TAB
          const url = `/class-session/${enrollment.id}?scheduleId=${cls.id}`;
          window.open(url, '_blank');
          toast.success("Securely connecting to class...");
      } else {
          toast.error("Enrollment ID missing.");
      }
  };

  const formatTime = (time: string) => format(parse(time, 'HH:mm:ss', new Date()), 'h:mm a');

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Join Class</h1>
      {todaysClasses.length === 0 ? <p>No classes today.</p> : (
          <div className="grid gap-4">
            {todaysClasses.map(cls => {
                const isActive = activeBatchSubjects.has(`${cls.batch}|${cls.subject}`);
                return (
                    <Card key={cls.id} className={`border-l-4 ${isActive ? 'border-l-green-500' : 'border-l-gray-300'}`}>
                        <CardContent className="p-6 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold">{cls.subject}</h3>
                                <p className="text-muted-foreground">{cls.batch}</p>
                                <p className="text-sm mt-1">{formatTime(cls.start_time)} - {formatTime(cls.end_time)}</p>
                            </div>
                            {isActive ? (
                                <Button size="lg" onClick={() => handleJoin(cls)} className="bg-green-600 hover:bg-green-700 animate-pulse">
                                    <Video className="mr-2 h-5 w-5" /> Join Now
                                </Button>
                            ) : (
                                <Button disabled variant="outline">
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Waiting for Teacher...
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
          </div>
      )}
    </div>
  );
};
