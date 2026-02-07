import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Star, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { differenceInHours, format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

// --- Types ---
interface UserEnrollment {
    batch_name: string;
    subject_name: string;
}

interface FeedbackTask {
    batch: string;
    subject: string;
    canSubmit: boolean;
    lastSubmissionDate?: Date;
}

// --- Star Rating Component ---
const StarRating = ({ rating, setRating }: { rating: number, setRating: (rating: number) => void }) => (
  <div className="flex gap-2">
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        className={`cursor-pointer transition-all duration-200 h-8 w-8 ${
            rating >= star 
                ? 'text-yellow-400 fill-yellow-400' 
                : 'text-gray-200 hover:text-gray-300'
        }`}
        onClick={() => setRating(star)}
      />
    ))}
  </div>
);

export const StudentFeedback = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<FeedbackTask | null>(null);
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
  const { data: submittedFeedback = [], isLoading: isLoadingFeedback } = useQuery({
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

  // 3. Process Data
  const feedbackTasks: FeedbackTask[] = useMemo(() => {
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
        // 72 hours cooldown
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

  // 4. Mutations
  const submitFeedbackMutation = useMutation({
    mutationFn: async (feedbackData: any) => {
      const { error } = await supabase.from('feedback').insert([feedbackData]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-submitted-feedback'] });
      toast({ title: 'Success', description: 'Feedback submitted successfully', variant: "default" });
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
    setSelectedTask(null);
  };

  const handleOpenDialog = (task: FeedbackTask) => {
    setSelectedTask(task);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (Object.values(ratings).some(r => r === 0)) {
      toast({ title: 'Ratings Required', description: 'Please rate all categories.', variant: 'destructive' });
      return;
    }
    const feedbackToSubmit = {
        batch: selectedTask?.batch,
        subject: selectedTask?.subject,
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

  const isLoading = isLoadingEnrollments || isLoadingFeedback;

  return (
    <div className="min-h-screen bg-white font-sans text-[#000000]">
      
      {/* Header */}
      <header className="pt-8 pb-4 px-6 md:px-8 max-w-[900px] mx-auto">
        <button 
            onClick={() => navigate(-1)} 
            className="text-[#666666] hover:text-[#000000] text-[0.9rem] flex items-center gap-1 transition-colors"
        >
            <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </header>

      {/* Main Container */}
      <main className="max-w-[900px] mx-auto px-6 md:px-8 pb-20">
        
        {/* Section Header */}
        <div className="mb-12">
            <h1 className="text-[2rem] font-semibold tracking-tight mb-2">Your Voice Matters</h1>
            <p className="text-[#666666] text-base">Provide feedback for your enrolled subjects.</p>
        </div>

        {/* Feedback List */}
        <div className="flex flex-col gap-6">
            {isLoading ? (
                // Loading Skeletons
                [1, 2, 3].map((i) => (
                    <div key={i} className="border border-[#ededed] rounded-xl p-8 flex justify-between items-center">
                        <div className="space-y-3 w-full">
                            <Skeleton className="h-6 w-24 rounded-md" />
                            <Skeleton className="h-8 w-64 rounded-md" />
                            <Skeleton className="h-4 w-48 rounded-md" />
                        </div>
                        <Skeleton className="h-12 w-32 rounded-lg hidden md:block" />
                    </div>
                ))
            ) : feedbackTasks.length > 0 ? (
                feedbackTasks.map((task, index) => (
                    <div 
                        key={index} 
                        className="group border border-[#ededed] rounded-xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:border-[#d1d1d1] transition-colors duration-200 bg-white"
                    >
                        {/* Card Content */}
                        <div className="flex flex-col gap-2">
                            <span className="bg-[#f5f5f5] text-[#666666] text-[0.7rem] font-semibold uppercase tracking-wider px-3 py-1 rounded-[4px] w-fit">
                                {task.batch}
                            </span>
                            <h2 className="text-[1.2rem] font-semibold text-black">
                                {task.subject}
                            </h2>
                            <p className="text-[0.85rem] text-[#666666]">
                                {task.lastSubmissionDate 
                                    ? `Last feedback given: ${format(new Date(task.lastSubmissionDate), 'd MMM yyyy')}`
                                    : "No feedback given yet"
                                }
                            </p>
                        </div>

                        {/* Action / Status */}
                        {task.canSubmit ? (
                            <button 
                                onClick={() => handleOpenDialog(task)}
                                className="w-full md:w-auto bg-[#000000] text-white px-6 py-3 rounded-lg font-medium text-[0.9rem] hover:opacity-85 transition-opacity"
                            >
                                Share Feedback
                            </button>
                        ) : (
                            <span className="text-[#10b981] text-[0.85rem] font-semibold bg-[#f0fdf4] px-4 py-2 rounded-lg whitespace-nowrap">
                                Submitted
                            </span>
                        )}
                    </div>
                ))
            ) : (
                <div className="text-center py-20 border border-dashed border-[#ededed] rounded-xl">
                    <p className="text-[#666666]">You are not enrolled in any batches yet.</p>
                </div>
            )}
        </div>
      </main>

      {/* Feedback Dialog Form */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-xl bg-white rounded-xl border-[#ededed]">
            <DialogHeader className="border-b border-[#ededed] pb-4">
                <DialogTitle className="text-xl font-semibold">
                    Feedback for {selectedTask?.subject}
                </DialogTitle>
                <DialogDescription className="text-[#666666]">
                   {selectedTask?.batch}
                </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-6 max-h-[60vh] overflow-y-auto px-1">
                {questions.map(({ key, text }) => (
                    <div key={key} className="space-y-3">
                        <label className="text-sm font-medium text-[#000000]">{text}</label>
                        <StarRating
                            rating={ratings[key as keyof typeof ratings]}
                            setRating={(rating) => setRatings(prev => ({ ...prev, [key]: rating }))}
                        />
                    </div>
                ))}

                <div className="space-y-3">
                    <label className="text-sm font-medium text-[#000000]">Additional Comments</label>
                    <Textarea
                        className="resize-none min-h-[100px] border-[#ededed] focus:border-black focus:ring-0"
                        placeholder="Tell us more about your experience..."
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                    />
                </div>
            </div>

            <DialogFooter className="border-t border-[#ededed] pt-4 gap-3">
                <DialogClose asChild>
                    <Button variant="outline" onClick={resetForm} className="border-[#ededed] text-[#666666]">
                        Cancel
                    </Button>
                </DialogClose>
                <Button 
                    onClick={handleSubmit} 
                    className="bg-black hover:bg-black/90 text-white"
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
