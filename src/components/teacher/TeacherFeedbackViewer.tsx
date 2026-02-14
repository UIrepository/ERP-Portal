import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Star, Calendar, User, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

// Helper to parse batch/subject arrays stored as strings
const cleanList = (raw: any): string[] => {
  if (!raw) return [];
  let list: any[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
      else list = [raw];
    } catch {
      list = raw.split(',').map(s => s.trim());
    }
  }
  return list.map(s => String(s).replace(/[\[\]"']/g, '').trim()).filter(s => s);
};

export const TeacherFeedbackViewer = () => {
  const { profile } = useAuth();

  // 1. Fetch Teacher's Batches & Subjects
  const { data: teacherData } = useQuery({
    queryKey: ['teacher-assignments', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return null;
      const { data, error } = await supabase
        .from('teachers')
        .select('assigned_batches, assigned_subjects')
        .eq('user_id', profile.user_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.user_id,
  });

  // 2. Fetch Feedback filtered by those Batches & Subjects
  const { data: feedbacks = [], isLoading } = useQuery({
    queryKey: ['teacher-feedback', teacherData],
    queryFn: async () => {
      if (!teacherData) return [];
      
      const batches = cleanList(teacherData.assigned_batches);
      const subjects = cleanList(teacherData.assigned_subjects);

      if (batches.length === 0 || subjects.length === 0) return [];

      // Fetch feedback matching ANY of the teacher's batches AND subjects
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .in('batch', batches)
        .in('subject', subjects)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!teacherData,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Student Feedback</h2>
        <Badge variant="outline" className="text-muted-foreground">
          {feedbacks.length} Reviews
        </Badge>
      </div>

      {feedbacks.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed">
          <MessageSquare className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-muted-foreground">No feedback received yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {feedbacks.map((feedback) => (
            <Card key={feedback.id} className="rounded-md border-slate-200 shadow-sm hover:shadow-md transition-shadow bg-white flex flex-col h-full">
              <CardHeader className="pb-2 space-y-1">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-semibold text-slate-800 line-clamp-1">
                      {feedback.subject}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                        {feedback.batch}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(feedback.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center bg-yellow-50 px-2 py-1 rounded border border-yellow-100">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 mr-1" />
                    <span className="text-sm font-bold text-yellow-700">{feedback.teacher_quality}/5</span>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1">
                <div className="space-y-3">
                  {/* Detailed Ratings */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded">
                    <div className="flex justify-between">
                      <span>Clarity:</span>
                      <span className="font-medium text-slate-700">{feedback.concept_clarity}/5</span>
                    </div>
                    <div className="flex justify-between">
                      <span>DPP:</span>
                      <span className="font-medium text-slate-700">{feedback.dpp_quality}/5</span>
                    </div>
                  </div>

                  {/* Comment */}
                  {feedback.comments && (
                    <ScrollArea className="h-24 w-full rounded border border-slate-100 bg-slate-50/50 p-2">
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {feedback.comments}
                      </p>
                    </ScrollArea>
                  )}

                  {/* Footer info */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                     <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {feedback.submitted_by ? 'Student' : 'Anonymous'}
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
