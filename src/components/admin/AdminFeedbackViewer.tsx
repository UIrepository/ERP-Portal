import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, User, Calendar, Star, BarChart2, Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

// Interface for the fetched feedback data, including joined profile info
interface FeedbackEntry {
  id: string;
  date: string;
  subject: string;
  batch: string;
  submitted_by: string | null;
  created_at: string;
  teacher_quality: number;
  concept_clarity: number;
  dpp_quality: number;
  premium_content_usefulness: number;
  comments: string;
  profiles: {
    name: string;
    email: string;
  } | null;
}

// Skeleton loader component for feedback cards
const FeedbackSkeleton = () => (
  <div className="space-y-4">
    {[...Array(3)].map((_, i) => (
      <Card key={i} className="rounded-xl">
        <CardHeader>
          <Skeleton className="h-6 w-1/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    ))}
  </div>
);

// Star rating display component
const RatingDisplay = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-1">
    {[...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
      />
    ))}
  </div>
);

export const AdminFeedbackViewer = () => {
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const queryClient = useQueryClient();

  // Set up real-time subscription for feedback data
  useEffect(() => {
    const channel = supabase
      .channel('feedback-realtime-admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feedback' },
        (payload) => {
          console.log(`Real-time update from feedback table: ${payload.eventType}`);
          queryClient.invalidateQueries({ queryKey: ['admin-feedback-viewer'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch all feedback data, including joined profile information
  const { data: feedback = [], isLoading, isError, error } = useQuery<FeedbackEntry[]>({
    queryKey: ['admin-feedback-viewer'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feedback')
        .select(`
          id,
          date,
          subject,
          batch,
          submitted_by,
          created_at,
          teacher_quality,
          concept_clarity,
          dpp_quality,
          premium_content_usefulness,
          comments,
          profiles!inner (
            name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching feedback:", error);
        throw error;
      }
      
      // Transform the data to match our interface
      const transformedData: FeedbackEntry[] = (data || []).map(item => ({
        ...item,
        profiles: item.profiles && typeof item.profiles === 'object' && !Array.isArray(item.profiles)
          ? item.profiles as { name: string; email: string }
          : null
      }));
      
      return transformedData;
    },
  });

  // Memoized data for filters and filtered display
  const { allBatches, allSubjects, filteredFeedback } = useMemo(() => {
    const uniqueBatches = new Set<string>();
    const uniqueSubjects = new Set<string>();

    feedback.forEach(f => {
      if (f.batch) uniqueBatches.add(f.batch);
      if (f.subject) uniqueSubjects.add(f.subject);
    });

    const filtered = feedback.filter(f =>
      (selectedBatch === 'all' || f.batch === selectedBatch) &&
      (selectedSubject === 'all' || f.subject === selectedSubject)
    );
    
    return {
      allBatches: Array.from(uniqueBatches).sort(),
      allSubjects: Array.from(uniqueSubjects).sort(),
      filteredFeedback: filtered,
    };
  }, [feedback, selectedBatch, selectedSubject]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="p-6 space-y-8 bg-gradient-to-br from-purple-50 to-indigo-50 min-h-full flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600" />
          <p className="text-xl text-gray-700">Loading Feedback...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (isError) {
    return (
      <div className="p-6 space-y-8 bg-gradient-to-br from-purple-50 to-indigo-50 min-h-full flex items-center justify-center text-center">
        <Card className="p-8 rounded-3xl shadow-xl border-red-400 border-2 bg-white">
          <AlertTriangle className="h-16 w-16 text-red-600 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Feedback</h3>
          <p className="text-gray-600 mb-4">
            There was a problem fetching feedback data. This could be due to:
          </p>
          <ul className="list-disc list-inside text-left text-gray-700 space-y-1">
            <li>Incorrect Row Level Security (RLS) policies on `public.feedback` or `public.profiles`.</li>
            <li>Your admin user's role not being `super_admin` in the `public.profiles` table.</li>
            <li>Network issues or a temporary Supabase outage.</li>
          </ul>
          <p className="mt-4 text-sm text-red-500">Error details: {error?.message || 'Unknown error'}</p>
          <p className="mt-4 text-gray-600">Please check your Supabase dashboard and try again.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 bg-gradient-to-br from-purple-50 to-indigo-50 min-h-full">
      {/* Header Section - Enhanced Design */}
      <div className="relative p-8 rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-r from-purple-600 to-indigo-700 text-white animate-fade-in-up">
            {/* Animated background circles */}
            <div className="absolute -top-16 -left-16 w-48 h-48 bg-white/10 rounded-full animate-pulse-slow"></div>
            <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-white/10 rounded-full animate-pulse-slow animation-delay-500"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white/10 rounded-full animate-pulse-slow animation-delay-1000"></div>

            <div className="relative z-10 text-center">
                <div className="flex items-center justify-center mb-4">
                    <BarChart2 className="h-16 w-16 text-purple-100 drop-shadow-md" />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2 tracking-tight drop-shadow-lg">
                    Student Feedback Analytics
                </h1>
                <p className="text-xl md:text-2xl text-purple-100 drop-shadow-sm font-semibold">
                    Gain insights from all student responses to improve teaching.
                </p>
            </div>
        </div>

       {/* Filter Section */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select value={selectedBatch} onValueChange={setSelectedBatch}>
            <SelectTrigger className="bg-white"><SelectValue placeholder="Filter by Batch" /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Batches</SelectItem>
                {allBatches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
        </Select>
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="bg-white"><SelectValue placeholder="Filter by Subject" /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {allSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
        </Select>
      </div>

      {/* Feedback List */}
      <div className="space-y-6">
        {filteredFeedback.length > 0 ? (
          filteredFeedback.map((item: FeedbackEntry) => (
            <Card key={item.id} className="bg-white rounded-xl shadow-md">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-xl font-bold">{item.subject} <Badge variant="secondary">{item.batch}</Badge></CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-2 text-base text-gray-600">
                                <User className="h-5 w-5 text-purple-500" /> {item.profiles?.name || 'Anonymous'} ({item.profiles?.email || 'No email'})
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
                <p className="mt-4 text-base text-gray-800 italic">"{item.comments}"</p>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-20 bg-white rounded-lg border-dashed border-2 shadow-sm">
            <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700">No Feedback Found</h3>
            <p className="text-muted-foreground mt-2">There is no feedback available matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
};
