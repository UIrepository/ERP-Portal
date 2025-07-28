
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

export const TeacherFeedback = () => {
  const { profile } = useAuth();

  const { data: feedback } = useQuery({
    queryKey: ['teacher-feedback'],
    queryFn: async () => {
      const { data } = await supabase
        .from('feedback')
        .select('*')
        .eq('batch', profile?.batch)
        .in('subject', profile?.subjects || [])
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!profile?.batch && !!profile?.subjects
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Student Feedback</h2>
        <div className="flex gap-2">
          <Badge variant="outline">Batch: {profile?.batch}</Badge>
          <Badge variant="outline">Subjects: {profile?.subjects?.join(', ')}</Badge>
        </div>
      </div>

      <div className="grid gap-4">
        {feedback && feedback.length > 0 ? (
          feedback.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <Badge variant="outline">{item.subject}</Badge>
                      <Badge variant="outline">{item.batch}</Badge>
                    </div>
                    <p className="text-sm mb-3">{item.feedback_text}</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted on {format(new Date(item.created_at), 'PPp')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No feedback received yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Students can provide feedback about your classes
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
