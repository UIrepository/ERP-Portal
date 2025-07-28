
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Video, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export const StudentCurrentClass = () => {
  const { profile } = useAuth();

  const { data: todaySchedule } = useQuery({
    queryKey: ['student-today-schedule'],
    queryFn: async () => {
      const today = new Date().getDay();
      const { data } = await supabase
        .from('schedules')
        .select('*')
        .eq('day_of_week', today)
        .eq('batch', profile?.batch)
        .in('subject', profile?.subjects || [])
        .order('start_time');
      return data || [];
    },
    enabled: !!profile?.batch && !!profile?.subjects
  });

  const { data: todayExtraClasses } = useQuery({
    queryKey: ['student-today-extra-classes'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('extra_classes')
        .select('*')
        .eq('date', today)
        .eq('batch', profile?.batch)
        .in('subject', profile?.subjects || [])
        .order('start_time');
      return data || [];
    },
    enabled: !!profile?.batch && !!profile?.subjects
  });

  const getCurrentClass = () => {
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    
    // Check regular schedule
    const currentRegular = todaySchedule?.find(schedule => {
      const startTime = schedule.start_time;
      const endTime = schedule.end_time;
      return currentTime >= startTime && currentTime <= endTime;
    });

    if (currentRegular) return { ...currentRegular, type: 'regular' };

    // Check extra classes
    const currentExtra = todayExtraClasses?.find(extraClass => {
      const startTime = extraClass.start_time;
      const endTime = extraClass.end_time;
      return currentTime >= startTime && currentTime <= endTime;
    });

    if (currentExtra) return { ...currentExtra, type: 'extra' };

    return null;
  };

  const getNextClass = () => {
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    
    // Combine all classes for today
    const allClasses = [
      ...(todaySchedule?.map(s => ({ ...s, type: 'regular' })) || []),
      ...(todayExtraClasses?.map(e => ({ ...e, type: 'extra' })) || [])
    ].sort((a, b) => a.start_time.localeCompare(b.start_time));

    return allClasses.find(cls => cls.start_time > currentTime);
  };

  const currentClass = getCurrentClass();
  const nextClass = getNextClass();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Current Class</h2>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Video className="mr-2 h-5 w-5" />
            Live Class Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentClass ? (
            <div className="text-center py-6">
              <div className="mb-4">
                <h3 className="text-2xl font-bold text-green-600">{currentClass.subject}</h3>
                <p className="text-muted-foreground mt-2">
                  {currentClass.start_time} - {currentClass.end_time}
                </p>
                <div className="flex justify-center gap-2 mt-2">
                  <Badge variant="default">{currentClass.batch}</Badge>
                  <Badge variant={currentClass.type === 'extra' ? 'secondary' : 'outline'}>
                    {currentClass.type === 'extra' ? 'Extra Class' : 'Regular Class'}
                  </Badge>
                </div>
              </div>
              
              <div className="mb-4">
                <Badge variant="default" className="text-lg px-4 py-2">
                  <Clock className="mr-2 h-4 w-4" />
                  Live Now
                </Badge>
              </div>

              {currentClass.link && (
                <Button size="lg" asChild>
                  <a href={currentClass.link} target="_blank" rel="noopener noreferrer">
                    Join Class Now
                  </a>
                </Button>
              )}

              {currentClass.type === 'extra' && 'reason' in currentClass && currentClass.reason && (
                <p className="text-sm text-muted-foreground mt-4">
                  Reason: {currentClass.reason}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Video className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-muted-foreground">
                No class is currently ongoing
              </h3>
              
              {nextClass && (
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Next Class:</h4>
                  <p className="text-lg font-semibold">{nextClass.subject}</p>
                  <p className="text-sm text-muted-foreground">
                    at {nextClass.start_time}
                  </p>
                  <div className="flex justify-center gap-2 mt-2">
                    <Badge variant="outline">{nextClass.batch}</Badge>
                    <Badge variant={nextClass.type === 'extra' ? 'secondary' : 'outline'}>
                      {nextClass.type === 'extra' ? 'Extra Class' : 'Regular Class'}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Full Schedule */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="mr-2 h-5 w-5" />
            Today's Full Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todaySchedule && todaySchedule.length > 0 ? (
            <div className="space-y-3">
              {todaySchedule.map((schedule, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <h4 className="font-medium">{schedule.subject}</h4>
                    <p className="text-sm text-muted-foreground">
                      {schedule.start_time} - {schedule.end_time}
                    </p>
                  </div>
                  <Badge variant="outline">{schedule.batch}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No regular classes scheduled for today
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
