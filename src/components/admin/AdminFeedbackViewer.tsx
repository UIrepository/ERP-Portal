import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, User, Calendar, Star, Loader2, AlertTriangle, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

// --- Interfaces for our data structures ---
interface FeedbackEntry {
  id: string;
  date: string;
  subject: string;
  batch: string;
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

// --- Helper component for displaying star ratings ---
const RatingDisplay = ({ rating, label }: { rating: number, label: string }) => (
  <div className="flex items-center justify-between py-2">
    <p className="text-sm text-slate-600">{label}</p>
    <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
        <Star
            key={i}
            className={`h-5 w-5 ${i < rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`}
        />
        ))}
    </div>
  </div>
);

export const AdminFeedbackViewer = () => {
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const queryClient = useQueryClient();

  // --- Real-time Subscription ---
  useEffect(() => {
    const channel = supabase
      .channel('feedback-realtime-admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feedback' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['admin-feedback-viewer'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // --- Data Fetching ---
  const { data: feedback = [], isLoading, isError, error } = useQuery<FeedbackEntry[]>({
    queryKey: ['admin-feedback-viewer'],
    queryFn: async () => {
      // This query now correctly joins with the profiles table.
      const { data, error } = await supabase
        .from('feedback')
        .select(`*, profiles ( name, email )`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching feedback:", error);
        throw error;
      }
      return data.filter(item => item.profiles) as FeedbackEntry[];
    },
  });

  // --- Data Processing ---
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


  // --- Rendering ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-10">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="m-6 text-center py-20 bg-white rounded-lg border-dashed border-2 border-red-400 shadow-sm">
        <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-destructive">Failed to Load Feedback Data</h3>
        <p className="text-muted-foreground mt-2">
          There was an error fetching the required data. Please ensure your RLS policies are correct.
        </p>
        <p className="text-sm text-gray-500 mt-4">
          <strong>Error:</strong> {error?.message}
        </p>
      </Card>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6 bg-slate-100 min-h-full">
      {/* Header */}
      <div className="px-1">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Feedback Viewer</h1>
        <p className="text-slate-500 mt-1">Review and analyze all feedback submitted by students.</p>
      </div>

      {/* Filters */}
       <Card className="bg-white/70 backdrop-blur-sm shadow-lg border-slate-200">
        <CardHeader>
            <CardTitle className="flex items-center text-lg">
                <Filter className="mr-3 h-5 w-5"/>
                Filter Submissions
            </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="text-sm font-medium text-slate-500 mb-2 block">Batch</label>
                <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                    <SelectTrigger className="focus:ring-2 focus:ring-indigo-500"><SelectValue placeholder="Select Batch" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Batches</SelectItem>
                        {allBatches.map(batch => (<SelectItem key={batch} value={batch}>{batch}</SelectItem>))}
                    </SelectContent>
                </Select>
            </div>
             <div>
                <label className="text-sm font-medium text-slate-500 mb-2 block">Subject</label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger className="focus:ring-2 focus:ring-indigo-500"><SelectValue placeholder="Select Subject" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Subjects</SelectItem>
                        {allSubjects.map(subject => (<SelectItem key={subject} value={subject}>{subject}</SelectItem>))}
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>

      {/* Feedback List */}
      <div className="space-y-6">
        {filteredFeedback.length > 0 ? (
          filteredFeedback.map((item: FeedbackEntry) => (
            <Card key={item.id} className="bg-white shadow-md rounded-xl overflow-hidden">
                <CardHeader className="bg-slate-50 p-4 border-b">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                {item.profiles?.name.charAt(0)}
                            </div>
                            <div>
                                <p className="font-semibold text-slate-800">{item.profiles?.name}</p>
                                <p className="text-xs text-slate-500">{item.profiles?.email}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <Calendar className="h-4 w-4" />
                                <span>{format(new Date(item.created_at), 'PPP')}</span>
                            </div>
                             <div className="flex items-center gap-2 mt-1">
                                <Badge variant="default" className="bg-indigo-600">{item.batch}</Badge>
                                <Badge variant="outline">{item.subject}</Badge>
                            </div>
                        </div>
                    </div>
                </CardHeader>
              <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <h4 className="font-semibold text-slate-700">Ratings</h4>
                    <Separator/>
                    <RatingDisplay rating={item.teacher_quality} label="Teacher Quality" />
                    <RatingDisplay rating={item.concept_clarity} label="Concept Clarity" />
                    <RatingDisplay rating={item.dpp_quality} label="DPP Quality" />
                    <RatingDisplay rating={item.premium_content_usefulness} label="Premium Content" />
                </div>
                 <div className="space-y-2">
                     <h4 className="font-semibold text-slate-700">Comments</h4>
                     <Separator/>
                     <div className="p-4 bg-slate-50 rounded-lg border h-full">
                        <p className="text-slate-800 italic leading-relaxed">"{item.comments}"</p>
                     </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-20 bg-white rounded-lg border-dashed border-2 shadow-sm">
            <MessageSquare className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700">No Feedback Found</h3>
            <p className="text-muted-foreground mt-2">There is no feedback available matching your filter criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
};
