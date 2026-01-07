import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, MessageSquare, Calendar, User, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export const TeacherFeedbackViewer = () => {
  const { user } = useAuth();
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

  // 1. Fetch Teacher Info
  const { data: teacherInfo } = useQuery({
    queryKey: ['teacherInfo', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // 2. Fetch Feedback (Filtered by Teacher's Assignments)
  const { data: feedbackList, isLoading } = useQuery({
    queryKey: ['teacherFeedback', teacherInfo?.assigned_batches, teacherInfo?.assigned_subjects],
    queryFn: async () => {
        if (!teacherInfo?.assigned_batches?.length || !teacherInfo?.assigned_subjects?.length) return [];

        const { data, error } = await supabase
            .from('feedback')
            .select('*')
            // Only fetch feedback relevant to this teacher's batches and subjects
            .in('batch', teacherInfo.assigned_batches)
            .in('subject', teacherInfo.assigned_subjects)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },
    enabled: !!teacherInfo
  });

  // 3. Client-side Filtering
  const filteredFeedback = feedbackList?.filter(item => {
      if (selectedBatch !== 'all' && item.batch !== selectedBatch) return false;
      if (selectedSubject !== 'all' && item.subject !== selectedSubject) return false;
      return true;
  });

  const clearFilters = () => {
    setSelectedBatch('all');
    setSelectedSubject('all');
  };

  // Helper for Star Rating
  const StarDisplay = ({ rating, label }: { rating: number, label: string }) => (
    <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex">
            {[1, 2, 3, 4, 5].map((star) => (
                <Star
                key={star}
                className={`h-3 w-3 ${rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-100'}`}
                />
            ))}
        </div>
    </div>
  );

  if (isLoading) {
    return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-6">
        {/* Header & Filters */}
        <div className="flex flex-col md:flex-row justify-between gap-4 items-end md:items-center bg-muted/20 p-4 rounded-lg border">
            <div>
                <h2 className="text-2xl font-bold">Student Feedback</h2>
                <p className="text-muted-foreground text-sm">View anonymous feedback from your classes</p>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                    <SelectTrigger className="w-[140px] bg-background"><SelectValue placeholder="Batch" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Batches</SelectItem>
                        {teacherInfo?.assigned_batches?.map((b: string) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger className="w-[140px] bg-background"><SelectValue placeholder="Subject" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Subjects</SelectItem>
                        {teacherInfo?.assigned_subjects?.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                </Select>
                {(selectedBatch !== 'all' || selectedSubject !== 'all') && (
                    <Button variant="ghost" size="icon" onClick={clearFilters} title="Clear Filters">
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>

        {/* Feedback List */}
        {!filteredFeedback?.length ? (
            <Card className="border-dashed">
                <CardContent className="p-12 text-center flex flex-col items-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                    <h3 className="font-semibold text-lg">No feedback found</h3>
                    <p className="text-muted-foreground text-sm max-w-sm mt-1">
                        There is no feedback available matching your current filter criteria.
                    </p>
                </CardContent>
            </Card>
        ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredFeedback.map((item) => (
                    <Card key={item.id} className="hover:shadow-md transition-all group">
                        <CardHeader className="pb-3 bg-muted/5 rounded-t-lg">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <div className="flex gap-2">
                                        <Badge variant="outline" className="bg-background">{item.batch}</Badge>
                                        <Badge className="bg-primary/10 text-primary hover:bg-primary/20">{item.subject}</Badge>
                                    </div>
                                </div>
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1 bg-background px-2 py-1 rounded-full border">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(item.created_at), 'MMM d')}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            {/* Ratings Grid */}
                            <div className="bg-muted/10 p-3 rounded-lg border border-border/50">
                                <StarDisplay label="Teacher Quality" rating={item.teacher_quality} />
                                <StarDisplay label="Concept Clarity" rating={item.concept_clarity} />
                                <StarDisplay label="DPP Quality" rating={item.dpp_quality} />
                                <StarDisplay label="Content Utility" rating={item.premium_content_usefulness} />
                            </div>

                            {/* Comments Section */}
                            <div className="relative">
                                <div className="absolute -left-2 -top-2 text-muted-foreground/20">
                                    <MessageSquare className="h-6 w-6" />
                                </div>
                                <p className="text-sm text-foreground/80 italic pl-4 border-l-2 border-primary/20 min-h-[60px]">
                                    "{item.comments || "No additional comments provided."}"
                                </p>
                            </div>

                            {/* Footer - Anonymous */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t mt-2">
                                <div className="bg-muted p-1 rounded-full">
                                    <User className="h-3 w-3" />
                                </div>
                                <span>Anonymous Student</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        )}
    </div>
  );
};
