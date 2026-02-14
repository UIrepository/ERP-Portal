import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Star, Calendar, User, MessageSquare } from 'lucide-react';
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
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between border-b pb-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800">Student Feedback</h2>
          <p className="text-sm text-muted-foreground mt-1">Review performance feedback from your assigned batches</p>
        </div>
        <Badge variant="secondary" className="px-3 py-1">
          {feedbacks.length} Reviews
        </Badge>
      </div>

      {feedbacks.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-md border border-dashed border-slate-300">
          <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">No feedback yet</h3>
          <p className="text-muted-foreground">Feedback collected from students will appear here.</p>
        </div>
      ) : (
        <div className="flex flex-col space-y-4">
          {feedbacks.map((feedback) => (
            <Card key={feedback.id} className="rounded-md border-slate-200 shadow-sm hover:shadow-md transition-all bg-white overflow-hidden">
              <CardContent className="p-5">
                
                {/* Header Row: Info (Left) vs Rating (Right) */}
                <div className="flex justify-between items-start mb-4">
                  {/* Left: Subject & Batch */}
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-lg text-slate-800 leading-none">{feedback.subject}</h3>
                    <div className="flex items-center gap-2">
                       <Badge variant="outline" className="rounded-sm font-normal text-slate-600 bg-slate-50 border-slate-200">
                         {feedback.batch}
                       </Badge>
                       <span className="text-xs text-slate-400 flex items-center">
                         <Calendar className="h-3 w-3 mr-1"/>
                         {format(new Date(feedback.created_at), 'MMM d, yyyy')}
                       </span>
                    </div>
                  </div>

                  {/* Right: Big Rating Block */}
                  <div className="flex items-center gap-3">
                     <div className="text-right hidden sm:block">
                        <div className="text-[10px] uppercase font-bold text-slate-400">Overall Rating</div>
                        <div className="text-xs text-slate-500 font-medium">Student Experience</div>
                     </div>
                     <div className="bg-yellow-50 border border-yellow-100 rounded-md px-3 py-2 flex flex-col items-center justify-center min-w-[70px]">
                        <div className="flex items-center text-yellow-700 font-bold text-xl leading-none mb-1">
                           {feedback.teacher_quality}<span className="text-sm text-yellow-600/70 font-normal">/5</span>
                        </div>
                        <div className="flex">
                           {[...Array(5)].map((_, i) => (
                             <Star 
                               key={i} 
                               className={`h-2.5 w-2.5 ${i < Math.round(feedback.teacher_quality) ? 'fill-yellow-500 text-yellow-500' : 'fill-slate-200 text-slate-200'}`} 
                             />
                           ))}
                        </div>
                     </div>
                  </div>
                </div>

                {/* Middle: Comment Section */}
                <div className="bg-slate-50/60 p-4 rounded-md border border-slate-100 mb-5 relative">
                   <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {feedback.comments || <span className="text-slate-400 italic">No detailed comments provided by the student.</span>}
                   </p>
                </div>

                {/* Footer: Granular Metrics & User Info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-50">
                   
                   {/* Metrics (Progress Bars) */}
                   <div className="flex flex-wrap gap-x-6 gap-y-2">
                      <div className="flex items-center gap-2 min-w-[140px]">
                         <span className="text-xs font-medium text-slate-500 w-20">Clarity</span>
                         <Progress value={(feedback.concept_clarity / 5) * 100} className="h-1.5 w-16 bg-slate-100" />
                         <span className="text-xs font-bold text-slate-700">{feedback.concept_clarity}</span>
                      </div>
                      <div className="flex items-center gap-2 min-w-[140px]">
                         <span className="text-xs font-medium text-slate-500 w-20">Materials</span>
                         <Progress value={(feedback.dpp_quality / 5) * 100} className="h-1.5 w-16 bg-slate-100" />
                         <span className="text-xs font-bold text-slate-700">{feedback.dpp_quality}</span>
                      </div>
                   </div>

                   {/* Submitted By */}
                   <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-white px-2 py-1 rounded-full border border-slate-100 shadow-sm self-start sm:self-auto">
                      <User className="h-3 w-3" />
                      <span>Submitted by {feedback.submitted_by ? 'Student' : 'Anonymous'}</span>
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
