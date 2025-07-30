// uirepository/teachgrid-hub/teachgrid-hub-403387c9730ea8d229bbe9118fea5f221ff2dc6c/src/components/student/StudentFeedback.tsx
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { MessageSquare, Send, CheckCircle, Star, Sparkles, XCircle } from 'lucide-react'; // Added XCircle for dialog close button
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

// Define the structure for an enrollment record from the new table
interface UserEnrollment {
    batch_name: string;
    subject_name: string;
}

const FeedbackTaskSkeleton = () => (
    <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
            <div key={i} className="p-4 border rounded-lg flex items-center justify-between bg-white">
                <div>
                    <Skeleton className="h-5 w-32 mb-1" />
                    <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-9 w-28" />
            </div>
        ))}
    </div>
);

const StarRating = ({ rating, setRating }: { rating: number, setRating: (rating: number) => void }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        className={`cursor-pointer transition-colors duration-200 ${rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 hover:text-gray-400'}`}
        onClick={() => setRating(star)}
      />
    ))}
  </div>
);

export const StudentFeedback = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFeedbackTask, setSelectedFeedbackTask] = useState<{ batch: string; subject: string } | null>(null);
  const [ratings, setRatings] = useState({
    teacher_quality: 0,
    concept_clarity: 0,
    dpp_quality: 0,
    premium_content_usefulness: 0,
  });
  const [comments, setComments] = useState('');

  // Fetch user's specific enrollments from the new table
  const { data: userEnrollments, isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
    queryKey: ['userEnrollments', profile?.user_id],
    queryFn: async () => {
        if (!profile?.user_id) return [];
        const { data, error } = await supabase
            .from('user_enrollments')
            .select('batch_name, subject_name')
            .eq('user_id', profile.user_id);
        if (error) {
            console.error("Error fetching user enrollments:", error);
            return [];
        }
        return data || [];
    },
    enabled: !!profile?.user_id
  });

  // Fetch already submitted feedback to mark tasks as completed
  const { data: submittedFeedback = [], isLoading: isLoadingSubmittedFeedback } = useQuery({
    queryKey: ['student-submitted-feedback', profile?.user_id, userEnrollments],
    queryFn: async () => {
      if (!profile?.user_id || !userEnrollments || userEnrollments.length === 0) return [];
      
      const combinations = userEnrollments.map(e => `and(batch.eq.${e.batch_name},subject.eq.${e.subject_name})`).join(',');

      const { data, error } = await supabase
        .from('feedback')
        .select('batch, subject')
        .eq('submitted_by', profile?.user_id)
        .or(combinations);

      if (error) {
        console.error("Error fetching submitted feedback:", error);
        return [];
      }
      return data || [];
    },
    enabled: !!profile?.user_id && !!userEnrollments && userEnrollments.length > 0,
  });

  // Generate feedback tasks based on userEnrollments
  const feedbackTasks = useMemo(() => {
    if (!userEnrollments) return [];
    
    const tasks: { batch: string; subject: string; submitted: boolean }[] = [];
    const submittedSet = new Set(submittedFeedback.map(f => `${f.batch}-${f.subject}`));

    userEnrollments.forEach(enrollment => {
        tasks.push({
            batch: enrollment.batch_name,
            subject: enrollment.subject_name,
            submitted: submittedSet.has(`${enrollment.batch_name}-${enrollment.subject_name}`),
        });
    });
    return tasks.sort((a,b) => a.subject.localeCompare(b.subject) || a.batch.localeCompare(b.batch));
  }, [userEnrollments, submittedFeedback]);

  const submitFeedbackMutation = useMutation({
    mutationFn: async (feedbackData: any) => {
      const { error } = await supabase.from('feedback').insert([{
        ...feedbackData,
        submitted_by: profile?.user_id,
        date: new Date().toISOString().split('T')[0],
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-submitted-feedback'] });
      toast({ title: 'Success', description: 'Thank you for your valuable feedback!', variant: "success" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setRatings({ teacher_quality: 0, concept_clarity: 0, dpp_quality: 0, premium_content_usefulness: 0 });
    setComments('');
    setSelectedFeedbackTask(null);
  };

  const handleOpenDialog = (task: { batch: string, subject: string }) => {
    setSelectedFeedbackTask(task);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (Object.values(ratings).some(r => r === 0) || !comments.trim()) {
      toast({ title: 'Incomplete Form', description: 'Please provide a rating for all questions and add a comment.', variant: 'destructive' });
      return;
    }
    submitFeedbackMutation.mutate({
      ...selectedFeedbackTask,
      ...ratings,
      comments,
    });
  };
  
  const questions = [
    { key: 'teacher_quality', text: 'Rate the quality of the teacher' },
    { key: 'concept_clarity', text: 'Are you understanding the concepts and explanations?' },
    { key: 'dpp_quality', text: 'Quality of questions in DPPs' },
    { key: 'premium_content_usefulness', text: 'Are you finding UI ki Padhai premium contents useful?' },
  ];

  const isLoading = isLoadingEnrollments || isLoadingSubmittedFeedback;

  return (
    <div className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 min-h-full flex flex-col justify-center items-center">
      <div className="max-w-4xl mx-auto w-full text-center">
        
        {/* Header Section - Premium Design */}
        <div className="relative p-8 rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white mb-10 animate-fade-in-up">
            {/* Animated background circles */}
            <div className="absolute -top-16 -left-16 w-48 h-48 bg-white/10 rounded-full animate-pulse-slow"></div>
            <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-white/10 rounded-full animate-pulse-slow animation-delay-500"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white/10 rounded-full animate-pulse-slow animation-delay-1000"></div>

            <div className="relative z-10">
                <div className="flex items-center justify-center mb-4">
                    <MessageSquare className="h-16 w-16 text-purple-100 drop-shadow-md" />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2 tracking-tight drop-shadow-lg">
                    Your Voice Matters
                </h1>
                <p className="text-xl md:text-2xl text-purple-100 drop-shadow-sm font-semibold">
                    Help us improve by sharing your valuable feedback.
                </p>
                <Badge variant="secondary" className="mt-5 bg-purple-100 text-purple-800 border-purple-200 text-base px-5 py-2 font-semibold shadow-md">
                    Anonymous & Impactful
                </Badge>
            </div>
        </div>

        {/* Feedback Tasks List */}
        <Card className="bg-white rounded-2xl shadow-xl animate-fade-in-up animation-delay-200">
          <CardHeader className="text-center p-6 border-b">
            <CardTitle className="text-2xl font-bold text-gray-800">Your Feedback Tasks</CardTitle>
            <CardDescription className="text-base text-gray-600">
              Submit feedback for each of your enrolled batch and subject combinations.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {isLoading ? (
                <FeedbackTaskSkeleton />
            ) : feedbackTasks.length > 0 ? (
                feedbackTasks.map((task, index) => (
                <div 
                    key={index} 
                    className={`p-4 border rounded-lg flex items-center justify-between transition-all duration-300 ${
                        task.submitted 
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 shadow-sm' 
                        : 'bg-white hover:bg-gray-50 hover:shadow-md'
                    }`}
                >
                    <div>
                        <p className="font-semibold text-gray-800">{task.subject}</p>
                        <p className="text-sm text-muted-foreground">Batch: {task.batch}</p>
                    </div>
                    {task.submitted ? (
                    <div className="flex items-center gap-2 text-green-600 font-medium">
                        <CheckCircle className="h-5 w-5 fill-green-500 text-white" />
                        <span>Feedback Submitted</span>
                    </div>
                    ) : (
                    <Button 
                        onClick={() => handleOpenDialog(task)} 
                        className="bg-primary hover:bg-primary/90 transition-all transform hover:scale-105 active:scale-95"
                    >
                        <Send className="mr-2 h-4 w-4" /> Give Feedback
                    </Button>
                    )}
                </div>
                ))
            ) : (
                <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-xl font-semibold mb-2">No Feedback Tasks Found</p>
                    <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                        It looks like you are not enrolled in any batches or subjects yet. Please contact your administrator for enrollment.
                    </p>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl bg-white p-0 rounded-2xl overflow-hidden shadow-2xl transform transition-all animate-fade-in-up"> {/* Enhanced DialogContent */}
          <DialogHeader className="relative p-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white"> {/* Enhanced Header */}
            <DialogTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                <MessageSquare className="h-6 w-6" /> Feedback for {selectedFeedbackTask?.subject} ({selectedFeedbackTask?.batch})
            </DialogTitle>
            <CardDescription className="text-blue-100 text-center mt-2">Your insights are highly valued and will help us improve.</CardDescription>
            <DialogClose asChild>
                <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20">
                    <XCircle className="h-6 w-6" />
                </Button>
            </DialogClose>
          </DialogHeader>
          <div className="space-y-6 py-6 px-6"> {/* Added padding for content */}
            {questions.map(({ key, text }) => (
              <div key={key} className="p-4 border border-gray-200 rounded-lg bg-gray-50"> {/* Individual question card */}
                <label className="font-semibold text-gray-700 flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-yellow-500" /> {text}
                </label>
                <div>
                  <StarRating 
                    rating={ratings[key as keyof typeof ratings]} 
                    setRating={(rating) => setRatings(prev => ({ ...prev, [key]: rating }))} 
                  />
                </div>
              </div>
            ))}
            <div>
              <label className="font-semibold text-gray-700 flex items-center gap-2 mb-3">
                <MessageSquare className="h-4 w-4 text-primary" /> Additional Comments (Mandatory)
              </label>
              <Textarea 
                className="mt-2 bg-white border-gray-300 focus-visible:ring-primary/50 shadow-sm" // More integrated styling
                rows={4}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Share more details about your experience, suggestions, or concerns..."
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row p-6 border-t border-gray-100 bg-gray-50"> {/* Enhanced Footer */}
            <DialogClose asChild>
                <Button variant="outline" onClick={resetForm} className="w-full sm:w-auto text-gray-700 border-gray-300 hover:bg-gray-100">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSubmit} className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white font-semibold">
                <Send className="mr-2 h-4 w-4"/>Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
