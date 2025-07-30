import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, ExternalLink, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

interface DPPContent {
  id: string;
  title: string;
  description?: string;
  difficulty?: string;
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

const DPPSkeleton = () => (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-5 space-y-4">
                <div className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="w-full space-y-2">
                        <Skeleton className="h-5 w-4/5" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                    </div>
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-10 w-full" />
            </Card>
        ))}
    </div>
);

export const StudentDPP = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');

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
    // If a specific batch is selected, only show subjects associated with that batch
    if (selectedBatchFilter !== 'all') {
      return Array.from(new Set(
        userEnrollments
          .filter(e => e.batch_name === selectedBatchFilter)
          .map(e => e.subject_name)
      )).sort();
    }
    // Otherwise (if 'All Batches' is selected), show all subjects available across all enrollments
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

  const { data: dppContent, isLoading: isLoadingDPPContent } = useQuery<DPPContent[]>({
    queryKey: ['student-dpp', userEnrollments, selectedBatchFilter, selectedSubjectFilter],
    queryFn: async (): Promise<DPPContent[]> => {
        if (!userEnrollments || userEnrollments.length === 0) return [];

        let query = supabase.from('dpp_content').select('*')
                            .eq('is_active', true); // Filter by is_active (assuming column exists)

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
            console.error("Error fetching filtered DPP content:", error);
            throw error;
        }
        return (data || []) as DPPContent[];
    },
    enabled: !!userEnrollments && userEnrollments.length > 0
  });

  // Set up real-time subscriptions for DPP data
  useEffect(() => {
    if (!profile?.user_id) return;

    const dppChannel = supabase
      .channel('dpp-realtime-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dpp_content'
        },
        () => {
          console.log('Real-time update: dpp_content changed');
          queryClient.invalidateQueries({ queryKey: ['student-dpp'] });
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
      supabase.removeChannel(dppChannel);
    };
  }, [profile?.user_id, queryClient]);

  const handleAccessDPP = (dpp: DPPContent) => {
    window.open(dpp.link, '_blank');
  };
  
  const isLoading = isLoadingEnrollments || isLoadingDPPContent;

  return (
    <div className="p-6 space-y-8 bg-gray-50/50 min-h-full">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            <Target className="mr-3 h-8 w-8 text-primary" />
            DPP Section
          </h1>
          <p className="text-gray-500 mt-1">Daily Practice Problems & Assignments.</p>
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
              placeholder="Search DPP content..."
              className="pl-10 h-10"
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

      {/* Content Grid */}
      <div>
        {isLoading ? (
          <DPPSkeleton />
        ) : dppContent && dppContent.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {dppContent.map((dpp) => (
              <Card key={dpp.id} className="bg-white hover:shadow-lg transition-shadow duration-300 flex flex-col rounded-xl overflow-hidden">
                <CardContent className="p-5 flex flex-col flex-grow">
                  <div className="flex-grow">
                    <div className="flex items-start gap-4 mb-3">
                      <div className="bg-primary/10 p-2 rounded-full flex-shrink-0">
                        <Target className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-gray-800 leading-tight">{dpp.title}</h3>
                        {dpp.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{dpp.description}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      <Badge variant="outline">{dpp.subject}</Badge>
                      <Badge variant="secondary">{dpp.batch}</Badge>
                      {dpp.difficulty && (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">{dpp.difficulty}</Badge>
                      )}
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleAccessDPP(dpp)}
                    className="w-full mt-5"
                    >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Start DPP
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-20 bg-white rounded-lg border-dashed border-2">
            <Target className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700">No DPP Content Yet</h3>
            <p className="text-muted-foreground mt-2">Daily practice problems for your batch and subjects will appear here soon.</p>
          </Card>
        )}
      </div>
    </div>
  );
};
