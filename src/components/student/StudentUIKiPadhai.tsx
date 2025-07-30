import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Crown, ExternalLink, Lock, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

interface UIKiPadhaiContent {
  id: string;
  title: string;
  description?: string;
  category?: string;
  link: string;
  is_active: boolean;
  created_at: string;
  batch: string;
  subject: string;
}

interface UserEnrollment {
    batch_name: string;
    subject_name: string;
}

const PremiumContentSkeleton = () => (
    <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                    </div>
                    <Skeleton className="h-10 w-28" />
                </div>
            </Card>
        ))}
    </div>
);

export const StudentUIKiPadhai = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: userEnrollments, isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
    queryKey: ['userEnrollments', profile?.user_id],
    queryFn: async () => {
        if (!profile?.user_id) return [];
        const { data, error } = await supabase
            .from('user_enrollments')
            .select('batch_name, subject_name')
            .eq('user_id', profile.user_id);
        if (error) {
            console.error("Error fetching user enrollments:", error);
            return [];
        }
        return data || [];
    },
    enabled: !!profile?.user_id
  });

  // Derived state for filter options, implementing cascading logic
  const displayedBatches = useMemo(() => {
    if (!userEnrollments) return [];
    if (selectedSubjectFilter === 'all') {
      return Array.from(new Set(userEnrollments.map(e => e.batch_name))).sort();
    } else {
      return Array.from(new Set(
        userEnrollments
          .filter(e => e.subject_name === selectedSubjectFilter)
          .map(e => e.batch_name)
      )).sort();
    }
  }, [userEnrollments, selectedSubjectFilter]);

  const displayedSubjects = useMemo(() => {
    if (!userEnrollments) return [];
    if (selectedBatchFilter !== 'all') {
      return Array.from(new Set(
        userEnrollments
          .filter(e => e.batch_name === selectedBatchFilter)
          .map(e => e.subject_name)
      )).sort();
    }
    return Array.from(new Set(userEnrollments.map(e => e.subject_name))).sort();
  }, [userEnrollments, selectedBatchFilter]);

  // Ensure selected filters are still valid when options change
  useEffect(() => {
    if (selectedBatchFilter !== 'all' && !displayedBatches.includes(selectedBatchFilter)) {
        setSelectedBatchFilter('all');
    }
  }, [selectedBatchFilter, displayedBatches]);

  useEffect(() => {
    if (selectedSubjectFilter !== 'all' && !displayedSubjects.includes(selectedSubjectFilter)) {
        setSelectedSubjectFilter('all');
    }
  }, [selectedSubjectFilter, displayedSubjects]);

  const { data: premiumContent, isLoading: isLoadingPremiumContent } = useQuery<UIKiPadhaiContent[]>({
    queryKey: ['student-ui-ki-padhai', userEnrollments, selectedBatchFilter, selectedSubjectFilter],
    queryFn: async (): Promise<UIKiPadhaiContent[]> => {
        if (!userEnrollments || userEnrollments.length === 0) return [];

        let query = supabase
            .from('dpp_content')
            .select('*')
            .eq('is_active', true);

        const combinationFilters = userEnrollments
            .filter(enrollment =>
                (selectedBatchFilter === 'all' || enrollment.batch_name === selectedBatchFilter) &&
                (selectedSubjectFilter === 'all' || enrollment.subject_name === selectedSubjectFilter)
            )
            .map(enrollment => `and(batch.eq.${enrollment.batch_name},subject.eq.${enrollment.subject_name})`);

        if (combinationFilters.length > 0) {
            query = query.or(combinationFilters.join(','));
        } else {
            return [];
        }
            
        query = query.order('created_at', { ascending: false });
        
        const { data, error } = await query;
      
        if (error) {
            console.error("Error fetching 'UI Ki Padhai' content:", error);
            throw error;
        }
        return (data || []) as UIKiPadhaiContent[];
    },
    enabled: !!userEnrollments && userEnrollments.length > 0
  });

  const filteredContent = useMemo(() => {
    return premiumContent?.filter(content => 
        content.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        content.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [premiumContent, searchTerm]);

  // Set up real-time subscriptions for UI Ki Padhai data
  useEffect(() => {
    if (!profile?.user_id) return;

    const uiKiPadhaiChannel = supabase
      .channel('ui-ki-padhai-realtime-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dpp_content'
        },
        () => {
          console.log('Real-time update: dpp_content changed');
          queryClient.invalidateQueries({ queryKey: ['student-ui-ki-padhai'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_enrollments',
          filter: `user_id=eq.${profile.user_id}`
        },
        () => {
          console.log('Real-time update: user_enrollments changed');
          queryClient.invalidateQueries({ queryKey: ['userEnrollments'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(uiKiPadhaiChannel);
    };
  }, [profile?.user_id, queryClient]);

  const handleAccessContent = (content: UIKiPadhaiContent) => {
    window.open(content.link, '_blank');
  };
  
  const isLoading = isLoadingEnrollments || isLoadingPremiumContent;

  return (
    <div className="p-6 space-y-8 bg-gray-50/50 min-h-full">
      {/* Header Section */}
      <div className="flex items-center justify-between">
          <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                  <Crown className="mr-3 h-8 w-8 text-primary" />
                  UI Ki Padhai
              </h1>
              <p className="text-gray-500 mt-1">Exclusive Premium Content & Advanced Courses.</p>
          </div>
          <div className="flex gap-2">
              {displayedBatches.map(b => <Badge key={b} variant="outline">{b}</Badge>)}
          </div>
      </div>

      {/* Filters and Search Section */}
      <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search premium content..."
              className="pl-10 h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={selectedBatchFilter} onValueChange={setSelectedBatchFilter}>
            <SelectTrigger className="w-48 h-10">
              <SelectValue placeholder="Filter by batch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Batches</SelectItem>
              {displayedBatches.map((batch) => (
                <SelectItem key={batch} value={batch}>{batch}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedSubjectFilter}
            onValueChange={setSelectedSubjectFilter}
            disabled={selectedBatchFilter === 'all'}
          >
            <SelectTrigger className="w-48 h-10">
              <SelectValue placeholder="Filter by subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {displayedSubjects.map((subject) => (
                <SelectItem key={subject} value={subject}>{subject}</SelectItem>
              ))}
            </SelectContent>
          </Select>
      </div>

      {/* Content List */}
      <div className="space-y-4">
          {isLoading ? (
            <PremiumContentSkeleton />
          ) : filteredContent && filteredContent.length > 0 ? (
            filteredContent.map((content) => (
                <Card key={content.id} className="bg-white">
                    <CardContent className="p-5 flex flex-col md:flex-row md:items-center md:justify-between">
                        <div className="flex-grow mb-4 md:mb-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-primary/10 p-2 rounded-full">
                                    <Crown className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-800">{content.title}</h3>
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{content.description}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3 pl-11">
                                <Badge variant="outline">{content.subject}</Badge>
                                <Badge variant="secondary">{content.batch}</Badge>
                                {content.category && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{content.category}</Badge>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button 
                                onClick={() => handleAccessContent(content)}
                            >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Access Content
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))
          ) : (
            <div className="text-center py-20 bg-white rounded-lg border-dashed border-2">
              <Crown className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700">No Premium Content Yet</h3>
              <p className="text-muted-foreground mt-2">Exclusive courses and materials for your batch and subjects will appear here soon.</p>
            </div>
          )}
      </div>
    </div>
  );
};
