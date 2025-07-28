
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock } from 'lucide-react';

export const StudentSchedule = () => {
  const { profile } = useAuth();

  const { data: schedule } = useQuery({
    queryKey: ['student-schedule'],
    queryFn: async () => {
      const { data } = await supabase
        .from('schedules')
        .select('*')
        .eq('batch', profile?.batch)
        .in('subject', profile?.subjects || [])
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });
      return data || [];
    },
    enabled: !!profile?.batch && !!profile?.subjects
  });

  const { data: extraClasses } = useQuery({
    queryKey: ['student-extra-classes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('extra_classes')
        .select('*')
        .eq('batch', profile?.batch)
        .in('subject', profile?.subjects || [])
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true });
      return data || [];
    },
    enabled: !!profile?.batch && !!profile?.subjects
  });

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  const scheduleByDay = schedule?.reduce((acc: any, item: any) => {
    const day = dayNames[item.day_of_week];
    if (!acc[day]) acc[day] = [];
    acc[day].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Class Schedule</h2>

      <div className="grid gap-4">
        {dayNames.map((day) => (
          <Card key={day}>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <Calendar className="mr-2 h-5 w-5" />
                {day}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scheduleByDay?.[day] && scheduleByDay[day].length > 0 ? (
                <div className="space-y-3">
                  {scheduleByDay[day].map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <h4 className="font-medium">{item.subject}</h4>
                        <div className="flex items-center text-sm text-muted-foreground mt-1">
                          <Clock className="h-4 w-4 mr-1" />
                          {item.start_time} - {item.end_time}
                        </div>
                      </div>
                      <Badge variant="outline">{item.batch}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No classes scheduled for {day}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {extraClasses && extraClasses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="mr-2 h-5 w-5" />
              Extra Classes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {extraClasses.map((extraClass) => (
                <div
                  key={extraClass.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <h4 className="font-medium">{extraClass.subject}</h4>
                    <div className="flex items-center text-sm text-muted-foreground mt-1">
                      <Clock className="h-4 w-4 mr-1" />
                      {extraClass.date} - {extraClass.start_time} to {extraClass.end_time}
                    </div>
                    {extraClass.reason && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Reason: {extraClass.reason}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary">{extraClass.batch}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
