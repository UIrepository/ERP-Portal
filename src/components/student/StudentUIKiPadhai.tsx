// uirepository/teachgrid-hub/teachgrid-hub-403387c9730ea8d229bbe9118fea5f221ff2dc6c/src/components/student/StudentUIKiPadhai.tsx
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Crown, ExternalLink, Lock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

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
    if (selectedBatchFilter === 'all') {
      return Array.from(new Set(userEnrollments.map(e => e.subject_name))).sort();
    } else {
      return Array.from(new Set(
        userEnrollments
          .filter(e => e.batch_name === selectedBatchFilter)
          .map(e => e.subject_name)
      )).sort();
    }
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
            .from('dpp_content') // Assuming 'dpp_content' also holds UI Ki Padhai content based on previous context. Adjust table if 'ui_ki_padhai_content' exists.
            .select('*')
            .eq('is_active', true);

        const combinationFilters = userEnrollments
            .filter(enrollment =>
                (selectedBatchFilter === 'all' || enrollment.batch_name === selectedBatchFilter) &&
                (selectedSubjectFilter === 'all' || enrollment.subject_name === selectedSubjectFilter)
            )
            .map(enrollment => `(batch.eq.${enrollment.batch_name},subject.eq.${enrollment.subject_name})`);

        if (combinationFilters.length > 0) {
            query = query.or(combinationFilters.join(','));
        } else {
            return [];
        }
            
        query = query.order('created_at', { ascending: false });
        
        const { data, error } = await query;
      
        if (error) {
            console.error("Error fetching 'UI Ki Padhai' content:", error);
            return [];
        }
        return (data || []) as UIKiPadhaiContent[];
    },
    enabled: !!userEnrollments && userEnrollments.length > 0
  });

  const handleAccessContent = (content: UIKiPadhaiContent) => {
    // This logic should be updated based on actual premium access field in profiles or user_enrollments if specific tiers exist
    const hasPremiumAccess = true; // For demonstration, assuming access if content is fetched. Replace with actual logic.

    if (hasPremiumAccess) {
      window.open(content.link, '_blank');
    } else {
      alert('This is premium content. Please contact an administrator to upgrade your access.');
    }
  };
  
  const isLoading = isLoadingEnrollments || isLoadingPremiumContent;

  return (
    <div className="p-6 space-y-8 bg-gray-50/50 min-h-full">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            <Crown className="mr-3 h-8 w-8 text-yellow-500" />
            UI Ki Padhai
          </h1>
          <p className="text-gray-500 mt-1">Exclusive premium content and advanced courses.</p>
        </div>
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200 text-sm px-4 py-2">
            Premium Content
        </Badge>
      </div>
      
      {/* Premium Banner - Shown if user does not have access */}
      {false && ( // Replace with !profile?.premium_access or similar
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-5 flex items-center gap-4">
                <div className="bg-yellow-100 p-3 rounded-full">
                    <Lock className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                    <h3 className="font-semibold text-yellow-800">Unlock Premium Content</h3>
                    <p className="text-sm text-yellow-700 mt-1">
                        Upgrade your account to access these exclusive courses and materials.
                    </p>
                </div>
            </CardContent>
          </Card>
      )}

      {/* Filter Section (similar to DPP and Recordings) */}
      <div className="flex gap-4">
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
        <Select value={selectedSubjectFilter} onValueChange={setSelectedSubjectFilter}>
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
          <PremiumContentSkeleton />
        ) : premiumContent && premiumContent.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {premiumContent.map((content) => (
              <Card key={content.id} className="bg-white hover:shadow-lg transition-shadow duration-300 flex flex-col">
                <CardContent className="p-5 flex flex-col flex-grow">
                  <div className="flex-grow">
                    <div className="flex items-start gap-4">
                      <div className="bg-yellow-100 p-2 rounded-full">
                        <Crown className="h-6 w-6 text-yellow-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{content.title}</h3>
                        {content.description && <p className="text-sm text-muted-foreground mt-1">{content.description}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {content.category && (
                        <Badge variant="outline">{content.category}</Badge>
                      )}
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleAccessContent(content)}
                    className="w-full mt-5 bg-yellow-500 hover:bg-yellow-600"
                    >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Access Content
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
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
