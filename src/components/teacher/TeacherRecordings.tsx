import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export const TeacherRecordings = () => {
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

  const { data: recordings, isLoading } = useQuery({
    queryKey: ['teacherRecordings', teacherInfo?.assigned_batches, teacherInfo?.assigned_subjects],
    queryFn: async () => {
      if (!teacherInfo?.assigned_batches?.length || !teacherInfo?.assigned_subjects?.length) {
        return [];
      }

      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .in('batch', teacherInfo.assigned_batches)
        .in('subject', teacherInfo.assigned_subjects)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!teacherInfo
  });

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
        <h2 className="text-xl font-semibold">My Recordings</h2>
        <p className="text-muted-foreground">Recorded lectures for your classes</p>
      </div>

      {!recordings?.length ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No recordings available yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recordings.map((recording) => (
            <Card key={recording.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Video className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold line-clamp-2">{recording.topic}</h3>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary">{recording.subject}</Badge>
                      <Badge variant="outline">{recording.batch}</Badge>
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(recording.date), 'MMM d, yyyy')}
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
