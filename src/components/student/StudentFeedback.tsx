import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { MessageSquare, Send, Star, Sparkles, Timer } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { differenceInHours, addDays, differenceInSeconds } from 'date-fns';

// Interface for enrollment records
interface UserEnrollment {
    batch_name: string;
    subject_name: string;
}

// --- New Dynamic Countdown Timer Component ---
const CooldownTimer = ({ lastSubmissionDate }: { lastSubmissionDate: Date }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const calculateTimeLeft = () => {
            const cooldownEndDate = addDays(lastSubmissionDate, 3);
            const totalSeconds = differenceInSeconds(cooldownEndDate, new Date());

            if (totalSeconds <= 0) {
                setTimeLeft("Available now!");
                return;
            }

            const days = Math.floor(totalSeconds / (3600 * 24));
            const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = Math.floor(totalSeconds % 60);

            let parts = [];
            if (days > 0) parts.push(`${days}d`);
            if (hours > 0) parts.push(`${hours}h`);
            if (minutes > 0) parts.push(`${minutes}m`);
            if (days === 0 && hours === 0) { // Only show seconds if less than an hour remains
                 parts.push(`${seconds}s`);
            }

            setTimeLeft(`Available in ${parts.join(' ')}`);
        };

        calculateTimeLeft();
        const intervalId = setInterval(calculateTimeLeft, 1000); // Update every second

        return () => clearInterval(intervalId);
    }, [lastSubmissionDate]);

    return (
        <div className="flex items-center gap-2 text-amber-600 font-medium text-sm">
            <Timer className="h-4 w-4" />
            <span>{timeLeft}</span>
        </div>
    );
};


// --- Star Rating Component ---
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
        const canSubmit = !lastSubmission || differenceInHours(new Date(), lastSubmission) >= 72; // 72 hours = 3 days

        return {
            batch: enrollment.batch_name,
            subject: enrollment.subject_name,
            canSubmit,
            lastSubmissionDate: lastSubmission,
        };
    }).sort((a,b) => a.subject.localeCompare(b.subject) || a.batch.localeCompare(b.batch));
  }, [userEnrollments, submittedFeedback]);

  const submitFeedbackMutation = useMutation({
    mutationFn: async (feedbackData: any) => {
      const { error } = await supabase.from('feedback').insert([feedbackData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-submitted-feedback'] });
      toast({ title: 'Success', description: 'Thank you for your valuable feedback!', variant: "default" });
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
    { key: 'teacher_quality', text: 'Rate the quality of the teacher' },
    { key: 'concept_clarity', text: 'Are you understanding the concepts and explanations?' },
    { key: 'dpp_quality', text: 'Quality of questions in DPPs' },
    { key: 'premium_content_usefulness', text: 'Are you finding UI ki Padhai premium contents useful?' },
  ];

  const isLoading = isLoadingEnrollments || isLoadingSubmittedFeedback;

  return (
    <div className="p-6 bg-gradient-to-br from-purple-50 to-indigo-50 min-h-full flex flex-col justify-center items-center">
      <div className="max-w-4xl mx-auto w-full text-center">
        {/* Header Section */}
        <div className="relative p-8 rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white mb-10">
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
        <Card className="bg-white rounded-2xl shadow-xl w-full max-w-4xl">
          <CardHeader className="text-center p-6 border-b">
            <CardTitle className="text-2xl font-bold text-gray-800">Your Feedback Tasks</CardTitle>
            <CardDescription className="text-base text-gray-600">
              Submit feedback for each of your classes. You can submit new feedback every 3 days.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {isLoading ? (
                <p>Loading your feedback tasks...</p>
            ) : feedbackTasks.map((task, index) => (
                <div
                    key={index}
                    className="p-4 border rounded-lg flex items-center justify-between transition-all duration-300 bg-white"
                >
                    <div>
                        <p className="font-semibold text-gray-800">{task.subject}</p>
                        <p className="text-sm text-muted-foreground">Batch: {task.batch}</p>
                    </div>
                    {task.canSubmit ? (
                        <Button
                            onClick={() => handleOpenDialog(task)}
                            className="bg-primary hover:bg-primary/90 transition-all transform hover:scale-105 active:scale-95"
                        >
                            <Send className="mr-2 h-4 w-4" /> Give Feedback
                        </Button>
                    ) : (
                        task.lastSubmissionDate && <CooldownTimer lastSubmissionDate={task.lastSubmissionDate} />
                    )}
                </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Dialog for submitting feedback */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          {/* Apply max height and overflow to DialogContent */}
          <DialogContent className="max-w-2xl bg-white p-0 rounded-2xl overflow-hidden shadow-2xl grid grid-rows-[auto_1fr_auto] max-h-[90vh]">
            <DialogHeader className="relative p-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white row-span-1">
                <DialogTitle className="text-2xl font-bold flex items-center justify-center gap-2">
                    <MessageSquare className="h-6 w-6" /> Feedback for {selectedFeedbackTask?.subject} ({selectedFeedbackTask?.batch})
                </DialogTitle>
                <DialogDescription className="text-blue-100 text-center mt-2">Your insights are highly valued and will help us improve.</DialogDescription>
            </DialogHeader>
            {/* Make this middle section scrollable */}
            <div className="space-y-6 py-6 px-6 overflow-y-auto row-span-1">
                {questions.map(({ key, text }) => (
                <div key={key} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
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
                    className="mt-2 bg-white border-gray-300 focus-visible:ring-primary/50 shadow-sm"
                    rows={4}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Share more details about your experience, suggestions, or concerns..."
                />
                </div>
            </div>
            {/* Keep DialogFooter at the bottom */}
            <DialogFooter className="flex-col sm:flex-row p-6 border-t border-gray-100 bg-gray-50 row-span-1">
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
