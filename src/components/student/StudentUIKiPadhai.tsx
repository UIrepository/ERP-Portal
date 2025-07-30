
import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Crown, ExternalLink, Search } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');

  const { data: userEnrollments, isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
    queryKey: ['userEnrollments', profile?.user_id],
    queryFn: async () => {
        if (!profile?.user_id) return [];
        const { data, error } = await supabase.from('user_enrollments').select('batch_name, subject_name').eq('user_id', profile.user_id);
        if (error) {
            console.error("Error fetching user enrollments:", error);
            return [];
        }
        return data || [];
    },
    enabled: !!profile?.user_id
  });

  const displayedBatches = useMemo(() => {
    if (!userEnrollments) return [];
    return Array.from(new Set(userEnrollments.map(e => e.batch_name))).sort();
  }, [userEnrollments]);

  const displayedSubjects = useMemo(() => {
    if (!userEnrollments || selectedBatchFilter === 'all') return [];
    return Array.from(new Set(userEnrollments.filter(e => e.batch_name === selectedBatchFilter).map(e => e.subject_name))).sort();
  }, [userEnrollments, selectedBatchFilter]);

  useEffect(() => {
    if (selectedBatchFilter === 'all') {
        setSelectedSubjectFilter('all');
    }
  }, [selectedBatchFilter]);

  const { data: premiumContent, isLoading: isLoadingPremiumContent } = useQuery<UIKiPadhaiContent[]>({
    queryKey: ['student-ui-ki-padhai', userEnrollments, selectedBatchFilter, selectedSubjectFilter],
    queryFn: async (): Promise<UIKiPadhaiContent[]> => {
        if (!userEnrollments || userEnrollments.length === 0) return [];
        
        const { data, error } = await supabase
            .from('ui_ki_padhai_content')
            .select('id, title, description, category, link, is_active, created_at, batch, subject')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("Error fetching 'UI Ki Padhai' content:", error);
            throw error;
        }

        if (!data) return [];

        // Filter content based on user enrollments and selected filters
        const filteredContent = data.filter(content => {
            if (!content.batch || !content.subject) return false;
            
            // Check if user is enrolled in this batch/subject combination
            const isEnrolled = userEnrollments.some(enrollment =>
                enrollment.batch_name === content.batch &&
                enrollment.subject_name === content.subject
            );

            if (!isEnrolled) return false;

            // Apply batch filter
            if (selectedBatchFilter !== 'all' && content.batch !== selectedBatchFilter) {
                return false;
            }

            // Apply subject filter
            if (selectedSubjectFilter !== 'all' && content.subject !== selectedSubjectFilter) {
                return false;
            }

            return true;
        });

        return filteredContent as UIKiPadhaiContent[];
    },
    enabled: !!userEnrollments && userEnrollments.length > 0
  });

  const filteredContent = useMemo(() => {
    if (!premiumContent) return [];
    return premiumContent.filter(content => 
        content.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (content.description && content.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [premiumContent, searchTerm]);

  const handleAccessContent = (content: UIKiPadhaiContent) => {
    window.open(content.link, '_blank');
  };
  
  const isLoading = isLoadingEnrollments || isLoadingPremiumContent;

  return (
    <div className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 min-h-full flex flex-col items-center">
      <div className="max-w-4xl mx-auto w-full">
        
        <div className="relative p-8 rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white mb-10 text-center animate-fade-in-up">
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
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="relative flex-1 col-span-full md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search content..."
              className="pl-10 h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={selectedBatchFilter} onValueChange={setSelectedBatchFilter}>
            <SelectTrigger className="w-full h-10">
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
              {displayedSubjects?.map((subject) => (
                <SelectItem key={subject} value={subject}>{subject}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <PremiumContentSkeleton />
          ) : filteredContent && filteredContent.length > 0 ? (
            filteredContent.map((content) => (
                <Card key={content.id} className="bg-white hover:shadow-xl transition-shadow duration-300 group">
                    <CardContent className="p-5 flex flex-col md:flex-row md:items-center md:justify-between">
                        <div className="flex-grow mb-4 md:mb-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-yellow-100 p-2 rounded-full flex-shrink-0">
                                    <Crown className="h-6 w-6 text-yellow-500" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-800 group-hover:text-primary transition-colors">{content.title}</h3>
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{content.description}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3 pl-12">
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
                                className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold"
                            >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Access Content
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))
          ) : (
            <div className="text-center py-20 bg-white rounded-lg border-dashed border-2 shadow-sm">
              <Crown className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700">No Premium Content Available</h3>
              <p className="text-muted-foreground mt-2">Please check back later for exclusive courses and materials.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
