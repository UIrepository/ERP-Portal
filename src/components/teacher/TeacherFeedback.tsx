
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';

interface Feedback {
  id: string;
  subject: string;
  batch: string;
  feedback_text: string;
  created_at: string;
  date: string;
}

export const TeacherFeedback = () => {
  const { profile } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState('');

  const { data: feedback } = useQuery({
    queryKey: ['teacher-feedback'],
    queryFn: async (): Promise<Feedback[]> => {
      const { data, error } = await supabase
        .from('feedback')
        .select('*')
        .eq('batch', profile?.batch)
        .in('subject', profile?.subjects || [])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.batch && !!profile?.subjects
  });

  const filteredFeedback = selectedSubject 
    ? feedback?.filter(fb => fb.subject === selectedSubject)
    : feedback;

  const groupedFeedback = filteredFeedback?.reduce((acc, fb) => {
    if (!acc[fb.subject]) acc[fb.subject] = [];
    acc[fb.subject].push(fb);
    return acc;
  }, {} as Record<string, Feedback[]>);

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Student Feedback</h2>
          <p className="text-gray-600 mt-1">Anonymous feedback from your students</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">Batch: {profile?.batch}</Badge>
        </div>
      </div>

      <div className="flex gap-4">
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
          <SelectTrigger className="w-48 bg-white">
            <SelectValue placeholder="Filter by subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Subjects</SelectItem>
            {profile?.subjects?.map((subject) => (
              <SelectItem key={subject} value={subject}>{subject}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedSubject ? (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-900">{selectedSubject}</h3>
          {groupedFeedback?.[selectedSubject]?.map((fb) => (
            <Card key={fb.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-gray-800">{fb.feedback_text}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="outline">{fb.subject}</Badge>
                      <span className="text-sm text-gray-500">
                        {format(new Date(fb.created_at), 'PPp')}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )) || (
            <Card>
              <CardContent className="p-8 text-center">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No feedback received for {selectedSubject}</p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedFeedback || {}).map(([subject, feedbacks]) => (
            <Card key={subject}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  {subject}
                  <Badge variant="secondary">{feedbacks.length} feedback(s)</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {feedbacks.slice(0, 3).map((fb) => (
                    <div key={fb.id} className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-gray-800 text-sm">{fb.feedback_text}</p>
                      <span className="text-xs text-gray-500 mt-2 block">
                        {format(new Date(fb.created_at), 'PP')}
                      </span>
                    </div>
                  ))}
                  {feedbacks.length > 3 && (
                    <p className="text-sm text-gray-500 text-center">
                      +{feedbacks.length - 3} more feedback(s)
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          
          {!groupedFeedback || Object.keys(groupedFeedback).length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">
                  No Feedback Yet
                </h3>
                <p className="text-gray-500">
                  Student feedback will appear here once submitted.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
