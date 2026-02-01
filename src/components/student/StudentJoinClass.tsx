import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Video, Clock, Loader2, Lock } from 'lucide-react';
import { format, isToday, parse } from 'date-fns';
import { toast } from 'sonner';

interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  date: string | null;
}

export const StudentJoinClass = () => {
  const { profile, user } = useAuth();
  
  // Store the active link if the class is live
  const [liveLink, setLiveLink] = useState<string | null>(null);

  // 1. Fetch My Enrollments
  const { data: enrollments } = useQuery({
    queryKey: ['studentEnrollments', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('user_enrollments').select('*').eq('user_id', user?.id);
      return data || [];
    }
  });

  // 2. Fetch My Schedule
  const { data: schedules, isLoading } = useQuery({
    queryKey: ['studentSchedule'],
    queryFn: async () => {
       const { data } = await supabase.from('schedules').select('*');
       return data || [];
    }
  });

  // 3. Filter for Today's Classes
  const todaysClasses = schedules?.filter(s => {
      if (!enrollments) return false;
      const isEnrolled = enrollments.some(e => e.batch_name === s.batch && e.subject_name === s.subject);
      const isTime = s.date ? isToday(new Date(s.date)) : (new Date().getDay() === s.day_of_week);
      return isEnrolled && isTime;
  }) || [];

  // 4. POLL for Teacher Status (Is the class active?)
  useEffect(() => {
    if (todaysClasses.length === 0) return;

    const checkStatus = async () => {
        const myBatches = enrollments?.map(e => e.batch_name) || [];
        if (myBatches.length === 0) return;

        const { data } = await supabase
            .from('active_classes')
            .select('room_url, batch, subject')
            .in('batch', myBatches)
            .eq('is_active', true);
        
        // If we find an active class that matches one of our schedules, save the link
        if (data && data.length > 0) {
            setLiveLink(data[0].room_url);
        } else {
            setLiveLink(null);
        }
    };

    // Check immediately and then every 5 seconds
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [enrollments, todaysClasses]);

  const handleJoin = (url: string) => {
      // Join as student
      window.open(url, '_blank');
      toast.success("Joining Class...");
  };

  const formatTime = (time: string) => format(parse(time, 'HH:mm:ss', new Date()), 'h:mm a');

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Join Class</h1>
      
      {todaysClasses.length === 0 ? (
          <p className="text-muted-foreground">No classes scheduled for today.</p>
      ) : (
          <div className="grid gap-4">
            {todaysClasses.map(cls => (
                <Card key={cls.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-6 flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-bold">{cls.subject}</h3>
                            <p className="text-muted-foreground">{cls.batch}</p>
                            <p className="text-sm mt-1">{formatTime(cls.start_time)} - {formatTime(cls.end_time)}</p>
                        </div>

                        {/* BUTTON LOGIC */}
                        {liveLink && cls.subject === todaysClasses.find(c => c.subject === cls.subject)?.subject ? (
                            <Button 
                                size="lg" 
                                onClick={() => handleJoin(liveLink)} 
                                className="bg-green-600 hover:bg-green-700 animate-pulse"
                            >
                                <Video className="mr-2 h-5 w-5" />
                                Join Now
                            </Button>
                        ) : (
                            <Button disabled variant="outline" className="min-w-[140px]">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Waiting for Teacher...
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ))}
          </div>
      )}
    </div>
  );
};
