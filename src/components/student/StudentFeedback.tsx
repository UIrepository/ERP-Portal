import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { MessageSquare, Send, CheckCircle, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';

const StarRating = ({ rating, setRating }: { rating: number, setRating: (rating: number) => void }) => (
  <div className="flex gap-1">
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        className={`cursor-pointer ${rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
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

  const { data: submittedFeedback = [] } = useQuery({
    queryKey: ['student-submitted-feedback', profile?.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('feedback')
        .select('batch, subject')
        .eq('submitted_by', profile?.user_id);
      return data || [];
    },
    enabled: !!profile?.user_id,
  });

  const feedbackTasks = useMemo(() => {
    const batches = Array.isArray(profile?.batch) ? profile.batch : [profile?.batch].filter(Boolean);
    if (!batches.length || !profile?.subjects) return [];
    
    const tasks: { batch: string; subject: string; submitted: boolean }[] = [];
    const submittedSet = new Set(submittedFeedback.map(f => `${f.batch}-${f.subject}`));

    batches.forEach(batch => {
      profile.subjects?.forEach(subject => {
        tasks.push({
          batch,
          subject,
          submitted: submittedSet.has(`${batch}-${subject}`),
        });
      });
    });
    return tasks;
  }, [profile, submittedFeedback]);

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
      toast({ title: 'Success', description: 'Thank you for your valuable feedback!' });
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

  return (
    <div className="p-6 space-y-8 bg-gray-50/50 min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            <MessageSquare className="mr-3 h-8 w-8 text-primary" />
            Submit Feedback
          </h1>
          <p className="text-gray-500 mt-1">Your feedback helps us improve. Please submit for each of your courses.</p>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Your Feedback Tasks</CardTitle>
          <CardDescription>Submit feedback for each of your enrolled batch and subject combinations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {feedbackTasks.map((task, index) => (
            <div key={index} className={`p-4 border rounded-lg flex items-center justify-between ${task.submitted ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
              <div>
                <p className="font-semibold">{task.subject}</p>
                <p className="text-sm text-muted-foreground">Batch: {task.batch}</p>
              </div>
              {task.submitted ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span>Completed</span>
                </div>
              ) : (
                <Button onClick={() => handleOpenDialog(task)}>Give Feedback</Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Feedback for {selectedFeedbackTask?.subject} ({selectedFeedbackTask?.batch})</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {questions.map(({ key, text }) => (
              <div key={key}>
                <label className="font-medium">{text}</label>
                <div className="mt-2">
                  <StarRating 
                    rating={ratings[key as keyof typeof ratings]} 
                    setRating={(rating) => setRatings(prev => ({ ...prev, [key]: rating }))} 
                  />
                </div>
              </div>
            ))}
            <div>
              <label className="font-medium">Additional Comments (Mandatory)</label>
              <Textarea 
                className="mt-2"
                rows={4}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Share more details..."
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" onClick={resetForm}>Cancel</Button></DialogClose>
            <Button onClick={handleSubmit}><Send className="mr-2 h-4 w-4"/>Submit Feedback</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
