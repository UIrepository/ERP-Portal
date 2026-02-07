import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { MessageSquare, Send, Star, Timer, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { differenceInHours, addDays, differenceInSeconds, format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

// Interface for enrollment records
interface UserEnrollment {
    batch_name: string;
    subject_name: string;
}

// --- Dynamic Countdown Timer Component ---
const CooldownTimer = ({ lastSubmissionDate }: { lastSubmissionDate: Date }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const calculateTimeLeft = () => {
            const cooldownEndDate = addDays(lastSubmissionDate, 3);
            const totalSeconds = differenceInSeconds(cooldownEndDate, new Date());

            if (totalSeconds <= 0) {
                setTimeLeft("Ready now");
                return;
            }

            const days = Math.floor(totalSeconds / (3600 * 24));
            const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);

            let parts = [];
            if (days > 0) parts.push(`${days}d`);
            if (hours > 0) parts.push(`${hours}h`);
            parts.push(`${minutes}m`);

            setTimeLeft(`${parts.join(' ')}`);
        };

        calculateTimeLeft();
        const intervalId = setInterval(calculateTimeLeft, 60000); 

        return () => clearInterval(intervalId);
    }, [lastSubmissionDate]);

    return (
        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full text-xs font-medium border border-amber-100">
            <Timer className="h-3.5 w-3.5" />
            <span>Available in {timeLeft}</span>
        </div>
    );
};

// --- Star Rating Component ---
const StarRating = ({ rating, setRating }: { rating: number, setRating: (rating: number) => void }) => (
  <div className="flex gap-1.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        className={`cursor-pointer transition-all duration-200 h-6 w-6 ${
            rating >= star 
                ? 'text-yellow-400 fill-yellow-400 scale-110' 
                : 'text-gray-200 hover:text-gray-300'
        }`}
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

  // 1. Fetch Enrollments
  const { data: userEnrollments, isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
    queryKey: ['userEnrollments', profile?.user_id],
    queryFn: async () => {
        if (!profile?.user_id) return [];
        const { data, error } = await supabase
            .from('user_enrollments')
            .select('batch_name, subject_name')
            .eq('user_id', profile.user_id);
        if (error) return [];
        return data || [];
    },
    enabled: !!profile?.user_id
  });

  // 2. Fetch Previous Feedback
  const { data: submittedFeedback = [], isLoading: isLoadingSubmittedFeedback } = useQuery({
    queryKey: ['student-submitted-feedback', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      const { data, error } = await supabase
        .from('feedback')
        .select('batch, subject, created_at')
        .eq('submitted_by', profile?.user_id)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!profile?.user_id,
  });

  // 3. Calculate Tasks
  const feedbackTasks = useMemo(() => {
    if (!userEnrollments) return [];

    const latestSubmissions = new Map<string, Date>();
    submittedFeedback.forEach(f => {
        const key = `${f.batch}-${f.subject}`;
        if (!latestSubmissions.has(key)) {
            latestSubmissions.set(key, new Date(f.created_at));
        }
    });

    return userEnrollments.map(enrollment => {
        const key = `${enrollment.batch_name}-${enrollment.subject_name}`;
        const lastSubmission = latestSubmissions.get(key);
        // 72 hours = 3 days cooldown
        const canSubmit = !lastSubmission || differenceInHours(new Date(), lastSubmission) >= 72;

        return {
            batch: enrollment.batch_name,
            subject: enrollment.subject_name,
            canSubmit,
            lastSubmissionDate: lastSubmission,
        };
    }).sort((a,b) => {
        if (a.canSubmit !== b.canSubmit) return a.canSubmit ? -1 : 1;
        return a.subject.localeCompare(b.subject);
    });
  }, [userEnrollments, submittedFeedback]);

  const submitFeedbackMutation = useMutation({
    mutationFn: async (feedbackData: any) => {
      const { error } = await supabase.from('feedback').insert([feedbackData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-submitted-feedback'] });
      toast({ title: 'Submitted Successfully', description: 'Your feedback has been recorded. Thank you!', variant: "default" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: 'Submission Failed', description: error.message, variant: 'destructive' });
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
    if (Object.values(ratings).some(r => r === 0)) {
      toast({ title: 'Ratings Required', description: 'Please provide a star rating for all categories.', variant: 'destructive' });
      return;
    }
    if (!comments.trim()) {
        toast({ title: 'Comment Required', description: 'Please tell us a bit more in the comments section.', variant: 'destructive' });
        return;
    }

    const feedbackToSubmit = {
        batch: selectedFeedbackTask?.batch,
        subject: selectedFeedbackTask?.subject,
        ...ratings,
        comments,
        submitted_by: profile?.user_id,
    };

    submitFeedbackMutation.mutate(feedbackToSubmit);
  };

  const questions = [
    { key: 'teacher_quality', text: 'Teacher Quality' },
    { key: 'concept_clarity', text: 'Concept Clarity' },
    { key: 'dpp_quality', text: 'DPP Quality' },
    { key: 'premium_content_usefulness', text: 'Premium Content' },
  ];

  const isLoading = isLoadingEnrollments || isLoadingSubmittedFeedback;

  return (
    <div className="min-h-full bg-slate-50/50 pb-20">
      
      {/* 1. White Header Section */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto py-8 px-6">
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
                <div className="bg-violet-100 p-2 rounded-lg">
                    <MessageSquare className="h-6 w-6 text-violet-600" />
                </div>
                Your Voice Matters
            </h1>
        </div>
      </div>

      {/* 2. Main Content - List View (1 row 1 card) */}
      <div className="max-w-4xl mx-auto px-6 mt-8">
        
        {isLoading ? (
            <div className="space-y-4">
                {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl w-full" />)}
            </div>
        ) : feedbackTasks.length > 0 ? (
            <div className="flex flex-col gap-4">
                {feedbackTasks.map((task, index) => (
                    <Card 
                        key={index} 
                        className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-md transition-shadow duration-200 border-slate-200"
                    >
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-normal">
                                    {task.batch}
                                </Badge>
                                {!task.canSubmit && (
                                    <span className="text-xs text-green-600 flex items-center gap-1">
                                        <CheckCircle2 className="h-3 w-3" /> Submitted
                                    </span>
                                )}
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">
                                {task.subject}
                            </h3>
                        </div>

                        <div className="flex-shrink-0">
                            {task.canSubmit ? (
                                <Button 
                                    onClick={() => handleOpenDialog(task)}
                                    className="w-full sm:w-auto bg-violet-600 hover:bg-violet-700 text-white font-medium shadow-sm"
                                >
                                    Share Feedback <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            ) : (
                                <div className="w-full sm:w-auto flex justify-center sm:justify-end">
                                    {task.lastSubmissionDate && <CooldownTimer lastSubmissionDate={task.lastSubmissionDate} />}
                                </div>
                            )}
                        </div>
                    </Card>
                ))}
            </div>
        ) : (
             <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
                <AlertCircle className="h-10 w-10 text-slate-400 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-900">No active classes found</h3>
                <p className="text-slate-500">You need to be enrolled in a batch to give feedback.</p>
            </div>
        )}
      </div>

      {/* 3. Feedback Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md w-full rounded-2xl p-0 overflow-hidden bg-white">
            <DialogHeader className="p-5 border-b bg-slate-50/80">
                <DialogTitle className="text-xl font-bold text-slate-800">
                    Feedback for {selectedFeedbackTask?.subject}
                </DialogTitle>
                <DialogDescription>
                    Rate your experience below
                </DialogDescription>
            </DialogHeader>

            <div className="p-5 space-y-6 overflow-y-auto max-h-[60vh]">
                {questions.map(({ key, text }) => (
                    <div key={key} className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-slate-700">{text}</label>
                        <StarRating
                            rating={ratings[key as keyof typeof ratings]}
                            setRating={(rating) => setRatings(prev => ({ ...prev, [key]: rating }))}
                        />
                    </div>
                ))}

                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700">Comments</label>
                    <Textarea
                        className="resize-none min-h-[100px]"
                        placeholder="Write your feedback here..."
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                    />
                </div>
            </div>

            <DialogFooter className="p-5 border-t bg-slate-50/80 flex-col sm:flex-row gap-2">
                <Button variant="ghost" onClick={resetForm} className="w-full sm:w-auto">Cancel</Button>
                <Button 
                    onClick={handleSubmit} 
                    className="bg-violet-600 hover:bg-violet-700 w-full sm:w-auto"
                    disabled={submitFeedbackMutation.isPending}
                >
                    {submitFeedbackMutation.isPending ? 'Submitting...' : 'Submit'}
                </Button>
            </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
};
