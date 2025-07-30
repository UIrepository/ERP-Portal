import { useEffect, useMemo } from 'react'; // Removed useState
import { useQuery, useQueryClient } from '@tanstack/react-query'; // Added useQueryClient
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, User, Calendar, Star, BarChart2 } from 'lucide-react';
import { format } from 'date-fns';
// Removed Select imports
import { Skeleton } from '@/components/ui/skeleton';

const FeedbackSkeleton = () => (
    <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
            <Card key={i} className="rounded-xl">
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
  // Removed selectedBatch and selectedSubject states
  const queryClient = useQueryClient(); // Initialize queryClient for invalidation

  // Set up real-time subscription for feedback data
  useEffect(() => {
    const channel = supabase
      .channel('feedback-realtime-admin') // Unique channel name
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

  // Removed memoization for filters, directly use all fetched feedback
  const allFeedback = useMemo(() => {
    return feedback;
  }, [feedback]);

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

       {/* Removed Filter Section */}

      {/* Feedback List */}
      <div className="space-y-6">
        {isLoading ? (
            <FeedbackSkeleton />
        ) : allFeedback.length > 0 ? (
          allFeedback.map((item: any) => (
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
            <p className="text-muted-foreground mt-2">There is no feedback available.</p>
          </div>
        )}
      </div>
    </div>
  );
};
