
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export const StudentExams = () => {
  const { profile } = useAuth();

  const { data: exams } = useQuery({
    queryKey: ['student-exams'],
    queryFn: async () => {
      const { data } = await supabase
        .from('exams')
        .select('*')
        .eq('batch', profile?.batch)
        .in('subject', profile?.subjects || [])
        .order('date', { ascending: true });
      return data || [];
    },
    enabled: !!profile?.batch && !!profile?.subjects
  });

  const upcomingExams = exams?.filter(exam => new Date(exam.date) >= new Date()) || [];
  const pastExams = exams?.filter(exam => new Date(exam.date) < new Date()) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Exams</h2>
        <div className="flex gap-2">
          <Badge variant="outline">Batch: {profile?.batch}</Badge>
          <Badge variant="outline">Subjects: {profile?.subjects?.join(', ')}</Badge>
        </div>
      </div>

      {upcomingExams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <GraduationCap className="mr-2 h-5 w-5" />
              Upcoming Exams
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingExams.map((exam) => (
                <div key={exam.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{exam.name}</h3>
                      <div className="flex items-center text-sm text-muted-foreground mt-1">
                        <Calendar className="h-4 w-4 mr-1" />
                        {format(new Date(exam.date), 'PPP')}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline">{exam.subject}</Badge>
                        <Badge variant="outline">{exam.batch}</Badge>
                        <Badge variant="secondary">{exam.type}</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {pastExams.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="mr-2 h-5 w-5" />
              Past Exams
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pastExams.map((exam) => (
                <div key={exam.id} className="p-4 border rounded-lg opacity-60">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{exam.name}</h3>
                      <div className="flex items-center text-sm text-muted-foreground mt-1">
                        <Calendar className="h-4 w-4 mr-1" />
                        {format(new Date(exam.date), 'PPP')}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline">{exam.subject}</Badge>
                        <Badge variant="outline">{exam.batch}</Badge>
                        <Badge variant="secondary">{exam.type}</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {exams && exams.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No exams scheduled</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
