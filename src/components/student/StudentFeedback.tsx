import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { MessageSquare, Send, Star, Sparkles, Timer, CheckCircle2, AlertCircle } from 'lucide-react';
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
        const intervalId = setInterval(calculateTimeLeft, 60000); // Update every minute is enough for this view

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
        className={`cursor-pointer transition-all duration-200 h-7 w-7 ${
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
        if (error) {
            console.error("Error fetching user enrollments:", error);
            return [];
        }
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

      if (error) {
        console.error("Error fetching submitted feedback:", error);
        return [];
      }
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
        // Sort: Can submit first, then alphabetical
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
    // Basic validation
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
    { key: 'teacher_quality', text: 'How would you rate the teacher quality?' },
    { key: 'concept_clarity', text: 'How clear are the concepts taught?' },
    { key: 'dpp_quality', text: 'How is the quality of the DPPs?' },
    { key: 'premium_content_usefulness', text: 'Is the premium content useful to you?' },
  ];

  const isLoading = isLoadingEnrollments || isLoadingSubmittedFeedback;

  return (
    <div className="min-h-full bg-slate-50/50 pb-20">
      
      {/* 1. Hero / Header Section */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white pt-12 pb-24 px-6 md:px-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/3 -translate-y-1/4">
             <MessageSquare className="w-96 h-96" />
        </div>
        <div className="max-w-6xl mx-auto relative z-10 text-center md:text-left">
            <h1 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">Your Voice Matters</h1>
            <p className="text-violet-100 text-lg md:text-xl max-w-2xl font-light leading-relaxed">
                Help us improve your learning experience by sharing your honest feedback. 
                Your insights directly shape our future classes.
            </p>
        </div>
      </div>

      {/* 2. Main Content Area */}
      <div className="max-w-6xl mx-auto px-6 -mt-16 relative z-20">
        
        {/* Section Title */}
        <div className="flex items-center gap-3 mb-6">
            <div className="bg-white p-2 rounded-lg shadow-sm">
                <MessageSquare className="h-5 w-5 text-violet-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Share Your Feedbacks</h2>
        </div>

        {/* 3. Cards Grid */}
        {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-xl w-full" />)}
            </div>
        ) : feedbackTasks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {feedbackTasks.map((task, index) => (
                    <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden group bg-white">
                        <div className={`h-2 w-full ${task.canSubmit ? 'bg-violet-500' : 'bg-gray-200'}`} />
                        
                        <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <Badge variant="outline" className="mb-2 text-xs font-normal text-gray-500 border-gray-200">
                                        {task.batch}
                                    </Badge>
                                    <CardTitle className="text-xl font-bold text-gray-800 group-hover:text-violet-700 transition-colors">
                                        {task.subject}
                                    </CardTitle>
                                </div>
                                {task.canSubmit ? (
                                    <div className="bg-green-50 p-1.5 rounded-full">
                                        <Sparkles className="h-4 w-4 text-green-600" />
                                    </div>
                                ) : (
                                    <div className="bg-gray-50 p-1.5 rounded-full">
                                        <CheckCircle2 className="h-4 w-4 text-gray-400" />
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        
                        <CardContent className="flex-grow pt-0 pb-4">
                            <CardDescription className="text-sm">
                                {task.canSubmit 
                                    ? "We're listening! Share your recent experience with this subject." 
                                    : task.lastSubmissionDate && `Last feedback submitted on ${format(task.lastSubmissionDate, 'MMM d, yyyy')}`
                                }
                            </CardDescription>
                        </CardContent>

                        <CardFooter className="pt-0 bg-gray-50/50 p-6 border-t border-gray-100">
                            {task.canSubmit ? (
                                <Button 
                                    onClick={() => handleOpenDialog(task)}
                                    className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold shadow-md shadow-violet-200"
                                >
                                    <Send className="mr-2 h-4 w-4" /> Give Feedback
                                </Button>
                            ) : (
                                <div className="w-full flex justify-between items-center">
                                    <span className="text-sm text-gray-500 font-medium">Next feedback:</span>
                                    {task.lastSubmissionDate && <CooldownTimer lastSubmissionDate={task.lastSubmissionDate} />}
                                </div>
                            )}
                        </CardFooter>
                    </Card>
                ))}
            </div>
        ) : (
             <Card className="p-12 text-center border-dashed border-2 bg-white/50">
                <div className="flex flex-col items-center justify-center text-gray-400">
                    <AlertCircle className="h-12 w-12 mb-4" />
                    <p className="text-lg font-medium text-gray-600">No active classes found</p>
                    <p className="text-sm">You need to be enrolled in a batch to give feedback.</p>
                </div>
            </Card>
        )}
      </div>

      {/* 4. Feedback Dialog (Dropdown/Modal) */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden rounded-2xl bg-white">
            <DialogHeader className="p-6 bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
                <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                    Feedback for {selectedFeedbackTask?.subject}
                </DialogTitle>
                <DialogDescription className="text-violet-100">
                    Your responses are anonymous and help us improve.
                </DialogDescription>
            </DialogHeader>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-8">
                {questions.map(({ key, text }) => (
                    <div key={key} className="space-y-3">
                        <label className="text-sm font-semibold text-gray-700 block">
                            {text} <span className="text-red-500">*</span>
                        </label>
                        <StarRating
                            rating={ratings[key as keyof typeof ratings]}
                            setRating={(rating) => setRatings(prev => ({ ...prev, [key]: rating }))}
                        />
                    </div>
                ))}

                <div className="space-y-3">
                    <label className="text-sm font-semibold text-gray-700 block">
                        Additional Comments <span className="text-red-500">*</span>
                    </label>
                    <Textarea
                        className="min-h-[100px] resize-none focus-visible:ring-violet-500"
                        placeholder="What did you like? What can be improved?"
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                    />
                </div>
            </div>

            <DialogFooter className="p-6 bg-gray-50 border-t flex-col sm:flex-row gap-3">
                <DialogClose asChild>
                    <Button variant="outline" onClick={resetForm} className="sm:w-auto w-full">Cancel</Button>
                </DialogClose>
                <Button 
                    onClick={handleSubmit} 
                    className="bg-violet-600 hover:bg-violet-700 text-white sm:w-auto w-full"
                    disabled={submitFeedbackMutation.isPending}
                >
                    {submitFeedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
                </Button>
            </DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
};
