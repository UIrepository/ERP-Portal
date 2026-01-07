import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, Calendar, ExternalLink, PlayCircle } from 'lucide-react';
import { format } from 'date-fns';

export const TeacherRecordings = () => {
  const { user } = useAuth();

  // 1. Fetch Teacher Profile to get their Batches and Subjects
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

  // 2. Fetch Recordings filtered strictly by Teacher's Assignments
  const { data: recordings, isLoading } = useQuery({
    queryKey: ['teacherRecordings', teacherInfo?.assigned_batches, teacherInfo?.assigned_subjects],
    queryFn: async () => {
      // If teacher has no batches or subjects assigned, return empty list
      if (!teacherInfo?.assigned_batches?.length || !teacherInfo?.assigned_subjects?.length) {
        return [];
      }

      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        // STRICT FILTER: Only show recordings where the batch is in the teacher's list
        .in('batch', teacherInfo.assigned_batches)
        // STRICT FILTER: Only show recordings where the subject is in the teacher's list
        .in('subject', teacherInfo.assigned_subjects)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    // Only run query if teacherInfo is loaded
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
        <h2 className="text-xl font-semibold">My Class Recordings</h2>
        <p className="text-muted-foreground">Access lecture recordings for your specific batches and subjects</p>
      </div>

      {!recordings?.length ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Recordings Found</h3>
            <p className="text-muted-foreground mt-1">
              No recordings found for your assigned batches ({teacherInfo?.assigned_batches?.join(', ') || 'None'}) 
              and subjects ({teacherInfo?.assigned_subjects?.join(', ') || 'None'}).
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recordings.map((recording) => (
            <Card key={recording.id} className="hover:shadow-md transition-all group border-l-4 border-l-primary/50">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors shrink-0">
                    <Video className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold line-clamp-2 leading-tight mb-2 text-base" title={recording.topic}>
                      {recording.topic}
                    </h3>
                    
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Badge variant="secondary" className="font-normal text-xs">
                        {recording.subject}
                      </Badge>
                      <Badge variant="outline" className="font-normal text-xs border-primary/20 bg-primary/5">
                        {recording.batch}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(recording.date), 'MMM d, yyyy')}
                      </div>
                    </div>
                    
                    {recording.link && (
                      <a 
                        href={recording.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors w-full justify-between group/link"
                      >
                        <span className="flex items-center gap-2">
                          <PlayCircle className="h-4 w-4" />
                          Watch Video
                        </span>
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                      </a>
                    )}
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
