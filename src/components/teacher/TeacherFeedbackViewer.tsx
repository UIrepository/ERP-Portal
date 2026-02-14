import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Star, Calendar, User, MessageSquare, Quote } from 'lucide-react';
import { format } from 'date-fns';

// Helper to parse batch/subject arrays
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

  const { data: feedbacks = [], isLoading } = useQuery({
    queryKey: ['teacher-feedback', teacherData],
    queryFn: async () => {
      if (!teacherData) return [];
      
      const batches = cleanList(teacherData.assigned_batches);
      const subjects = cleanList(teacherData.assigned_subjects);

      if (batches.length === 0 || subjects.length === 0) return [];

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
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Student Feedback</h2>
          <p className="text-sm text-muted-foreground">Recent reviews from your classes</p>
        </div>
        <Badge variant="secondary" className="px-3 py-1 text-sm">
          {feedbacks.length} Reviews
        </Badge>
      </div>

      {feedbacks.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-md border border-dashed border-slate-300">
          <MessageSquare className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-muted-foreground">No feedback received yet.</p>
        </div>
      ) : (
        <div className="flex flex-col space-y-4">
          {feedbacks.map((feedback) => (
            <Card key={feedback.id} className="rounded-md border-slate-200 shadow-sm hover:shadow-md transition-all bg-white overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row">
                  
                  {/* Left Side: Info & Ratings */}
                  <div className="md:w-64 bg-slate-50/50 p-4 border-r border-slate-100 flex flex-col justify-between shrink-0">
                    <div>
                      <h3 className="font-semibold text-slate-800 truncate mb-1" title={feedback.subject}>
                        {feedback.subject}
                      </h3>
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Badge variant="outline" className="bg-white text-xs font-normal text-slate-600 rounded-sm">
                          {feedback.batch}
                        </Badge>
                      </div>
                      <div className="flex items-center text-xs text-slate-500 gap-1.5 mb-4">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(feedback.created_at), 'MMM d, yyyy')}
                      </div>
                    </div>

                    {/* Compact Ratings Grid */}
                    <div className="space-y-2 text-sm">
                       <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-xs">Overall</span>
                          <div className="flex items-center bg-yellow-100 px-1.5 py-0.5 rounded-sm">
                             <Star className="h-3 w-3 fill-yellow-600 text-yellow-600 mr-1" />
                             <span className="font-bold text-yellow-800 text-xs">{feedback.teacher_quality}/5</span>
                          </div>
                       </div>
                       <div className="h-px bg-slate-200 w-full my-1" />
                       <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Clarity</span>
                          <span className="font-medium text-slate-700">{feedback.concept_clarity}/5</span>
                       </div>
                       <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Materials</span>
                          <span className="font-medium text-slate-700">{feedback.dpp_quality}/5</span>
                       </div>
                    </div>
                  </div>

                  {/* Right Side: Comments */}
                  <div className="flex-1 p-5 flex flex-col min-h-[140px]">
                    <div className="flex-1 relative">
                       <Quote className="h-8 w-8 text-slate-100 absolute -top-2 -left-2 -z-0" />
                       <ScrollArea className="h-full max-h-[150px] relative z-10">
                         {feedback.comments ? (
                           <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm pt-1 pl-1">
                             {feedback.comments}
                           </p>
                         ) : (
                           <p className="text-slate-400 italic text-sm pt-1 pl-1">No written comments provided.</p>
                         )}
                       </ScrollArea>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-slate-50 flex justify-end">
                       <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <User className="h-3 w-3" />
                          <span>Submitted by {feedback.submitted_by ? 'Student' : 'Anonymous'}</span>
                       </div>
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
