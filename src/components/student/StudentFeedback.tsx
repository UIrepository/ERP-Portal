import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Star, ArrowLeft, X } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose
} from '@/components/ui/drawer';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile'; 

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
const RATING_LABELS = ['Tap to rate', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

const StarRating = ({ rating, setRating }: { rating: number, setRating: (rating: number) => void }) => {
  const [hover, setHover] = useState(0);
  const active = hover || rating;
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex gap-1.5" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            type="button"
            key={star}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHover(star)}
            aria-label={`${star} out of 5`}
            className="p-0.5 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <Star
              className={`h-9 w-9 transition-all duration-150 ${
                active >= star
                  ? 'text-amber-400 fill-amber-400 scale-105'
                  : 'text-gray-200 hover:text-amber-200'
              }`}
            />
          </button>
        ))}
      </div>
      <span className={`text-sm font-medium min-w-[92px] ${active ? 'text-gray-700' : 'text-gray-300'}`}>
        {active ? `${active}/5 · ${RATING_LABELS[active]}` : RATING_LABELS[0]}
      </span>
    </div>
  );
};

// --- Shared question set (used by the feedback page and the mandatory gate) ---
export const FEEDBACK_QUESTIONS: { key: string; text: string; hint?: string }[] = [
  { key: 'teacher_quality', text: 'Teaching quality', hint: 'Was the teacher clear, engaging and well-prepared?' },
  { key: 'concept_clarity', text: 'Concept clarity', hint: 'How well did you understand the concepts taught?' },
  { key: 'dpp_quality', text: 'Practice problems (DPP)', hint: 'Were the DPPs and practice questions useful?' },
  { key: 'premium_content_usefulness', text: 'Premium content', hint: 'How helpful was the extra / premium material?' },
];

// --- Shared Form Content ---
export const FeedbackFormContent = ({
  questions,
  ratings,
  setRatings,
  comments,
  setComments
}: {
  questions: { key: string; text: string; hint?: string }[],
  ratings: any,
  setRatings: React.Dispatch<React.SetStateAction<any>>,
  comments: string,
  setComments: (value: string) => void
}) => (
  <div className="w-full max-w-[880px] mx-auto">
      {/* Ratings in a 2-column grid so the wide modal is used and there's little
          to scroll. Collapses to one column on narrow screens (mobile drawer). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6">
        {questions.map(({ key, text, hint }) => (
            <div key={key} className="space-y-2.5">
                <label className="block text-[14.5px] font-medium text-gray-800 leading-snug">{hint || text}</label>
                <StarRating
                    rating={ratings[key as keyof typeof ratings]}
                    setRating={(rating) => setRatings(prev => ({ ...prev, [key]: rating }))}
                />
            </div>
        ))}
      </div>

      <div className="mt-7 pt-6 border-t border-gray-100 space-y-3">
          <div>
            <label className="block text-[15px] font-semibold text-gray-900">Anything else you'd like to share?</label>
            <p className="text-[13px] text-gray-500 mt-0.5">What went well, and what could be better? Specifics help your teachers most.</p>
          </div>
          <Textarea
              className="resize-none min-h-[96px] rounded-xl border-gray-200 focus:border-gray-900 focus:ring-0 text-[14px]"
              placeholder="Your honest, detailed feedback helps your teachers improve…"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
          />
      </div>
  </div>
);

export const StudentFeedback = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile(); 
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<FeedbackTask | null>(null);
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
        if (error) return [];
        return data || [];
    },
    enabled: !!profile?.user_id
  });

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
        // Feedback is unlimited — no 72h cooldown. Students can share feedback
        // for any enrolled subject at any time (the last-given date is still shown).
        const canSubmit = true;

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

  const questions = FEEDBACK_QUESTIONS;

  const isLoading = isLoadingEnrollments || isLoadingFeedback;

  return (
    <div className="min-h-screen bg-white font-sans text-[#000000]">
      
      <header className="pt-8 pb-4 px-6 md:px-8 max-w-[900px] mx-auto">
        <button 
            onClick={() => navigate(-1)} 
            className="text-[#666666] hover:text-[#000000] text-[0.9rem] flex items-center gap-1 transition-colors"
        >
            <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </header>

      <main className="max-w-[900px] mx-auto px-6 md:px-8 pb-20">
        
        <div className="mb-12">
            <h1 className="text-[2rem] font-semibold tracking-tight mb-2">Your Voice Matters</h1>
            <p className="text-[#666666] text-base">Provide feedback for your enrolled subjects.</p>
        </div>

        <div className="flex flex-col gap-6">
            {isLoading ? (
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

      {isMobile ? (
        <Drawer open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DrawerContent className="max-h-[85vh]">
            <DrawerHeader className="text-left border-b border-[#ededed] pb-4">
              <DrawerTitle className="text-xl font-semibold">
                Feedback for {selectedTask?.subject}
              </DrawerTitle>
              <DrawerDescription className="text-[#666666]">
                {selectedTask?.batch}
              </DrawerDescription>
            </DrawerHeader>
            
            <div className="px-4 overflow-y-auto">
              <FeedbackFormContent 
                questions={questions}
                ratings={ratings}
                setRatings={setRatings}
                comments={comments}
                setComments={setComments}
              />
            </div>

            <DrawerFooter className="border-t border-[#ededed] pt-4">
              <Button 
                onClick={handleSubmit} 
                className="bg-black hover:bg-black/90 text-white w-full"
                disabled={submitFeedbackMutation.isPending}
              >
                {submitFeedbackMutation.isPending ? 'Submitting...' : 'Submit Feedback'}
              </Button>
              <DrawerClose asChild>
                <Button variant="outline" onClick={resetForm} className="border-[#ededed] text-[#666666] w-full">
                  Cancel
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogPortal>
            {/* Full-screen blurred backdrop, equal on all sides */}
            <DialogOverlay className="bg-black/40 backdrop-blur-md" />
            {/* Centered card taking ~75% of the viewport */}
            <DialogPrimitive.Content
              className="fixed left-1/2 top-1/2 z-50 flex flex-col -translate-x-1/2 -translate-y-1/2
                         w-[75vw] max-w-[900px] max-h-[88vh] bg-white rounded-2xl shadow-2xl overflow-hidden
                         data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200"
            >
              {/* Header */}
              <div className="px-8 pt-7 pb-5 border-b border-gray-100 shrink-0">
                <DialogPrimitive.Title className="text-[22px] font-semibold tracking-tight text-gray-900">
                  Feedback for {selectedTask?.subject}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-[14px] text-gray-500 mt-1">
                  {selectedTask?.batch} · takes under a minute
                </DialogPrimitive.Description>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-8 py-6">
                <FeedbackFormContent
                  questions={questions}
                  ratings={ratings}
                  setRatings={setRatings}
                  comments={comments}
                  setComments={setComments}
                />
              </div>

              {/* Footer */}
              <div className="px-8 py-5 border-t border-gray-100 shrink-0 flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => { resetForm(); setIsDialogOpen(false); }}
                  className="border-gray-200 text-gray-600"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="bg-black hover:bg-black/90 text-white px-6"
                  disabled={submitFeedbackMutation.isPending}
                >
                  {submitFeedbackMutation.isPending ? 'Submitting…' : 'Submit Feedback'}
                </Button>
              </div>

              <DialogPrimitive.Close className="absolute right-5 top-5 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300">
                <X className="h-5 w-5" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </DialogPrimitive.Content>
          </DialogPortal>
        </Dialog>
      )}
    </div>
  );
};
