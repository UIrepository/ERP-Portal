import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';

export const TeacherSchedule = () => {
  const { user } = useAuth();

  const { data: teacherInfo } = useQuery({
    queryKey: ['teacherInfo', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const { data: schedules, isLoading } = useQuery({
    queryKey: ['teacherSchedules', teacherInfo?.assigned_batches, teacherInfo?.assigned_subjects],
    queryFn: async () => {
      if (!teacherInfo?.assigned_batches?.length || !teacherInfo?.assigned_subjects?.length) {
        return [];
      }

      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .in('batch', teacherInfo.assigned_batches)
        .in('subject', teacherInfo.assigned_subjects)
        .order('day_of_week')
        .order('start_time');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!teacherInfo
  });

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">My Schedule</h2>
        <p className="text-muted-foreground">Classes assigned to you</p>
      </div>

      {teacherInfo && (
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-sm text-muted-foreground">Assigned Batches:</span>
          {teacherInfo.assigned_batches?.map((batch: string) => (
            <Badge key={batch} variant="secondary">{batch}</Badge>
          ))}
          <span className="text-sm text-muted-foreground ml-4">Subjects:</span>
          {teacherInfo.assigned_subjects?.map((subject: string) => (
            <Badge key={subject} variant="outline">{subject}</Badge>
          ))}
        </div>
      )}

      {!schedules?.length ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No classes scheduled yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {schedules.map((schedule) => (
            <Card key={schedule.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{schedule.subject}</h3>
                      <p className="text-sm text-muted-foreground">{schedule.batch}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{dayNames[schedule.day_of_week]}</Badge>
                    <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {schedule.start_time} - {schedule.end_time}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
