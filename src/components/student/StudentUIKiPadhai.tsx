
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

export const StudentUIKiPadhai = () => {
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
  if (selectedBatchFilter !== 'all' && !displayedBatches.includes(selectedBatchFilter)) {
      setSelectedBatchFilter('all');
  }
  if (selectedSubjectFilter !== 'all' && !displayedSubjects.includes(selectedSubjectFilter)) {
      setSelectedSubjectFilter('all');
  }

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
    const hasPremiumAccess = true; // For demonstration, assuming access if content is fetched
    if (hasPremiumAccess) {
      window.open(content.link, '_blank');
    } else {
      alert('This is premium content. Please contact an administrator to upgrade your access.');
    }
  };
  
  const isLoading = isLoadingEnrollments || isLoadingPremiumContent;

  return (
    <div className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 min-h-full flex flex-col justify-center items-center">
      <div className="max-w-4xl mx-auto w-full text-center">
        
        {/* Header Section - Enhanced */}
        <div className="relative p-8 rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white mb-10 animate-fade-in-up">
            <div className="absolute -top-16 -left-16 w-48 h-48 bg-white/10 rounded-full animate-pulse-slow"></div>
            <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-white/10 rounded-full animate-pulse-slow animation-delay-500"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white/10 rounded-full animate-pulse-slow animation-delay-1000"></div>

            <div className="relative z-10">
                <div className="flex items-center justify-center mb-4">
                    <Crown className="h-16 w-16 text-yellow-100 drop-shadow-md" />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2 tracking-tight drop-shadow-lg">
                    UI Ki Padhai
                </h1>
                <p className="text-xl md:text-2xl text-yellow-100 drop-shadow-sm font-semibold">
                    Exclusive Premium Content & Advanced Courses
                </p>
                <Badge variant="secondary" className="mt-5 bg-yellow-100 text-yellow-800 border-yellow-200 text-base px-5 py-2 font-semibold shadow-md">
                    Unlock Your Potential
                </Badge>
            </div>
        </div>

        {/* Filters and Search Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animate-fade-in-up animation-delay-200">
          <div className="relative flex-1 col-span-full md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search premium content..."
              className="pl-10 h-10 bg-white shadow-sm"
            />
          </div>
          <Select value={selectedBatchFilter} onValueChange={setSelectedBatchFilter}>
            <SelectTrigger className="w-full h-10 bg-white shadow-sm">
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
            <SelectTrigger className="w-full h-10">
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
            <PremiumContentSkeleton />
          ) : premiumContent && premiumContent.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 animate-fade-in-up animation-delay-300">
              {premiumContent.map((content) => (
                <Card key={content.id} className="bg-white hover:shadow-lg transition-shadow duration-300 flex flex-col rounded-xl overflow-hidden">
                  <CardContent className="p-5 flex flex-col flex-grow">
                    <div className="flex-grow">
                      <div className="flex items-start gap-4 mb-3">
                        <div className="bg-yellow-100 p-2 rounded-full flex-shrink-0">
                          <Crown className="h-6 w-6 text-yellow-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg text-gray-800 leading-tight">{content.title}</h3>
                          {content.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{content.description}</p>}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Badge variant="outline">{content.subject}</Badge>
                        <Badge variant="secondary">{content.batch}</Badge>
                        {content.category && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{content.category}</Badge>
                        )}
                      </div>
                    </div>
                    <Button 
                      onClick={() => handleAccessContent(content)}
                      className="w-full mt-5 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold transition-all transform hover:scale-[1.01] active:scale-95"
                      >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Access Content
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-20 bg-white rounded-lg border-dashed border-2 shadow-sm animate-fade-in-up">
              <Crown className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700">No Premium Content Yet</h3>
              <p className="text-muted-foreground mt-2">Exclusive courses and materials for your batch and subjects will appear here soon.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
