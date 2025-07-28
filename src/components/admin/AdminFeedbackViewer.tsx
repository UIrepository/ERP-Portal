
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, User, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export const AdminFeedbackViewer = () => {
  const { data: feedback } = useQuery({
    queryKey: ['admin-feedback'],
    queryFn: async () => {
      const { data } = await supabase
        .from('feedback')
        .select(`
          *,
          profiles!feedback_submitted_by_fkey (
            name,
            email
          )
        `)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Group feedback by subject and batch
  const groupedFeedback = feedback?.reduce((acc, item) => {
    const key = `${item.subject}-${item.batch}`;
    if (!acc[key]) {
      acc[key] = {
        subject: item.subject,
        batch: item.batch,
        feedback: [],
      };
    }
    acc[key].feedback.push(item);
    return acc;
  }, {} as Record<string, any>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center">
          <MessageSquare className="mr-2 h-6 w-6" />
          Feedback Viewer
        </h2>
        <p className="text-sm text-muted-foreground">
          View all feedback with full student identity
        </p>
      </div>

      <div className="space-y-6">
        {Object.values(groupedFeedback || {}).map((group: any) => (
          <Card key={`${group.subject}-${group.batch}`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{group.subject}</span>
                <Badge variant="outline">{group.batch}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {group.feedback.map((item: any) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{item.profiles?.name || 'Unknown Student'}</span>
                        <span className="text-sm text-muted-foreground">
                          ({item.profiles?.email || 'No email'})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(item.created_at), 'MMM dd, yyyy HH:mm')}
                      </div>
                    </div>
                    
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm">{item.feedback_text}</p>
                    </div>
                    
                    <div className="mt-3 flex justify-between items-center">
                      <Badge variant="secondary">{item.date}</Badge>
                      <Badge variant="outline">{item.subject} - {item.batch}</Badge>
                    </div>
                  </div>
                ))}
                
                {group.feedback.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No feedback received yet for this combination</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        
        {Object.keys(groupedFeedback || {}).length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Feedback Yet</h3>
              <p className="text-muted-foreground">
                Student feedback will appear here once submitted
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
