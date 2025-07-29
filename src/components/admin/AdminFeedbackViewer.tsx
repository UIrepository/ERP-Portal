import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, User, Calendar, Star } from 'lucide-react';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

const FeedbackSkeleton = () => (
    <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
            <Card key={i}>
                <CardHeader>
                    <Skeleton className="h-6 w-1/4" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                </CardContent>
            </Card>
        ))}
    </div>
);

const RatingDisplay = ({ rating }: { rating: number }) => (
    <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
            <Star key={i} className={`h-4 w-4 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
        ))}
    </div>
);

export const AdminFeedbackViewer = () => {
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');

  const { data: feedback = [], isLoading } = useQuery({
    queryKey: ['admin-feedback-viewer'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback')
        .select(`
          *,
          profiles (
            name,
            email
          )
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { allBatches, allSubjects, filteredFeedback } = useMemo(() => {
    const allBatches = new Set<string>();
    const allSubjects = new Set<string>();
    feedback.forEach(f => {
      if(f.batch) allBatches.add(f.batch);
      if(f.subject) allSubjects.add(f.subject);
    });

    const filtered = feedback.filter(f =>
      (selectedBatch === 'all' || f.batch === selectedBatch) &&
      (selectedSubject === 'all' || f.subject === selectedSubject)
    );
    
    return {
      allBatches: Array.from(allBatches).sort(),
      allSubjects: Array.from(allSubjects).sort(),
      filteredFeedback: filtered,
    };
  }, [feedback, selectedBatch, selectedSubject]);

  return (
    <div className="p-6 space-y-8 bg-gray-50/50 min-h-full">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Feedback Viewer</h1>
        <p className="text-gray-500 mt-1">Review feedback submitted by students with their identity.</p>
      </div>

       {/* Filter Section */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select value={selectedBatch} onValueChange={setSelectedBatch}>
            <SelectTrigger><SelectValue placeholder="Filter by Batch" /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Batches</SelectItem>
                {allBatches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
        </Select>
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger><SelectValue placeholder="Filter by Subject" /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {allSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
        </Select>
      </div>

      {/* Feedback List */}
      <div className="space-y-6">
        {isLoading ? (
            <FeedbackSkeleton />
        ) : filteredFeedback.length > 0 ? (
          filteredFeedback.map((item: any) => (
            <Card key={item.id} className="bg-white">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="flex items-center gap-2">{item.subject} <Badge variant="secondary">{item.batch}</Badge></CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-2">
                                <User className="h-4 w-4" /> {item.profiles?.name || 'Anonymous'} ({item.profiles?.email || 'No email'})
                            </CardDescription>
                        </div>
                        <div className="text-sm text-muted-foreground text-right">
                            <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                {format(new Date(item.created_at), 'PPP')}
                            </div>
                        </div>
                    </div>
                </CardHeader>
              <CardContent>
                <div className="space-y-3 p-4 border rounded-lg bg-gray-50">
                    <div className="flex justify-between items-center"><span className="font-medium text-sm">Teacher Quality</span> <RatingDisplay rating={item.teacher_quality} /></div>
                    <div className="flex justify-between items-center"><span className="font-medium text-sm">Concept Clarity</span> <RatingDisplay rating={item.concept_clarity} /></div>
                    <div className="flex justify-between items-center"><span className="font-medium text-sm">DPP Quality</span> <RatingDisplay rating={item.dpp_quality} /></div>
                    <div className="flex justify-between items-center"><span className="font-medium text-sm">Premium Content</span> <RatingDisplay rating={item.premium_content_usefulness} /></div>
                </div>
                <p className="mt-4 text-sm text-gray-800 italic">"{item.comments}"</p>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-20 bg-white rounded-lg border-dashed border-2">
            <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700">No Feedback Found</h3>
            <p className="text-muted-foreground mt-2">There is no feedback matching your current filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};
