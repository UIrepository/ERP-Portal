import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { MessageSquare, Send } from 'lucide-react';
import { format } from 'date-fns';

export const StudentFeedback = () => {
  const { profile } = useAuth();
  const [newFeedback, setNewFeedback] = useState({
    subject: '',
    feedback_text: ''
  });

  const queryClient = useQueryClient();

  const { data: submittedFeedback } = useQuery({
    queryKey: ['student-feedback'],
    queryFn: async () => {
      const { data } = await supabase
        .from('feedback')
        .select('*')
        .eq('batch', profile?.batch)
        .eq('submitted_by', profile?.user_id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!profile?.batch && !!profile?.user_id
  });

  const logActivity = async (activityType: string, description: string, metadata?: any) => {
    if (!profile?.user_id) return;
    
    await supabase.from('student_activities').insert({
      user_id: profile.user_id,
      activity_type: activityType,
      description,
      metadata,
      batch: profile.batch, // Add batch and subject to the log
      subject: newFeedback.subject,
    });
  };

  const submitFeedbackMutation = useMutation({
    mutationFn: async (feedbackData: any) => {
      const { error } = await supabase
        .from('feedback')
        .insert([{
          ...feedbackData,
          batch: profile?.batch,
          submitted_by: profile?.user_id,
          date: new Date().toISOString().split('T')[0]
        }]);
      
      if (error) throw error;
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['student-feedback'] });
      
      // Log the activity
      await logActivity('feedback_submit', `Submitted feedback for ${newFeedback.subject}`, {
        subject: newFeedback.subject,
        feedbackLength: newFeedback.feedback_text.length
      });
      
      setNewFeedback({
        subject: '',
        feedback_text: ''
      });
      toast({
        title: 'Success',
        description: 'Feedback submitted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmitFeedback = () => {
    if (!newFeedback.subject || !newFeedback.feedback_text) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    // Check if feedback already submitted for this subject
    const existingFeedback = submittedFeedback?.find(
      fb => fb.subject === newFeedback.subject
    );

    if (existingFeedback) {
      toast({
        title: 'Error',
        description: 'You have already submitted feedback for this subject',
        variant: 'destructive',
      });
      return;
    }

    submitFeedbackMutation.mutate(newFeedback);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Feedback</h2>
        <div className="flex gap-2">
          <Badge variant="outline">Batch: {profile?.batch}</Badge>
          <Badge variant="outline">Subjects: {profile?.subjects?.join(', ')}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submit Feedback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Select value={newFeedback.subject} onValueChange={(value) => setNewFeedback({ ...newFeedback, subject: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {profile?.subjects?.map((subject) => (
                  <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Textarea
              placeholder="Enter your feedback here..."
              value={newFeedback.feedback_text}
              onChange={(e) => setNewFeedback({ ...newFeedback, feedback_text: e.target.value })}
              rows={4}
            />
          </div>
          
          <Button onClick={handleSubmitFeedback} className="w-full">
            <Send className="h-4 w-4 mr-2" />
            Submit Feedback
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Submitted Feedback</CardTitle>
        </CardHeader>
        <CardContent>
          {submittedFeedback && submittedFeedback.length > 0 ? (
            <div className="space-y-4">
              {submittedFeedback.map((feedback) => (
                <div key={feedback.id} className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <Badge variant="outline">{feedback.subject}</Badge>
                    <span className="text-sm text-muted-foreground ml-auto">
                      {format(new Date(feedback.created_at), 'PPp')}
                    </span>
                  </div>
                  <p className="text-sm">{feedback.feedback_text}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No feedback submitted yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
