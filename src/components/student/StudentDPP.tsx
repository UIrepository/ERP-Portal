import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, ExternalLink, Search, ArrowLeft, Download } from 'lucide-react';
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

const DPPViewer = ({ dpp, onBack, onDownload, allDPPs, onDPPSelect }: { dpp: DPPContent, onBack: () => void, onDownload: (dpp: DPPContent) => void, allDPPs: DPPContent[], onDPPSelect: (dpp: DPPContent) => void }) => {
    const otherDPPs = allDPPs.filter(d => d.id !== dpp.id && d.batch === dpp.batch && d.subject === dpp.subject);

    return (
      <div className="p-4 md:p-6 space-y-6 bg-slate-100 min-h-full">
        <Button variant="outline" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to DPPs
        </Button>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
                <Card className="bg-white rounded-2xl overflow-hidden shadow-2xl">
                    <CardHeader className="p-6 border-b">
                        <div className="flex justify-between items-center">
                            <CardTitle>{dpp.title}</CardTitle>
                            <Button onClick={() => onDownload(dpp)}>
                                <Download className="h-4 w-4 mr-2" />
                                Download
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                    <div className="w-full h-[60vh] md:h-[75vh]">
                        <iframe
                        src={dpp.link}
                        className="w-full h-full"
                        title={dpp.title}
                        />
                    </div>
                    </CardContent>
                </Card>
            </div>
            <div className="md:col-span-1">
                <Card className="bg-white rounded-2xl shadow-2xl">
                    <CardHeader>
                        <CardTitle>Other DPPs</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {otherDPPs.map(otherDPP => (
                                <div key={otherDPP.id} className="p-3 border rounded-lg hover:shadow-md hover:border-primary/50 transition-all duration-200 cursor-pointer" onClick={() => onDPPSelect(otherDPP)}>
                                    <p className="font-semibold text-primary">{otherDPP.title}</p>
                                    <p className="text-xs text-muted-foreground">{otherDPP.description}</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    );
};

export const StudentDPP = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');
  const [selectedDPP, setSelectedDPP] = useState<DPPContent | null>(null);

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

  const displayedBatches = useMemo(() => {
    if (!userEnrollments) return [];
    return Array.from(new Set(userEnrollments.map(e => e.batch_name))).sort();
  }, [userEnrollments]);

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
  
  useEffect(() => {
    if (selectedBatchFilter === 'all') {
      setSelectedSubjectFilter('all');
    }
  }, [selectedBatchFilter]);


  const { data: dppContent, isLoading: isLoadingDPPContent } = useQuery<DPPContent[]>({
    queryKey: ['student-dpp', userEnrollments, selectedBatchFilter, selectedSubjectFilter],
    queryFn: async (): Promise<DPPContent[]> => {
        if (!userEnrollments || userEnrollments.length === 0) return [];

        let query = supabase.from('dpp_content').select('*').eq('is_active', true);

        const activeEnrollments = userEnrollments
            .filter(enrollment =>
                (selectedBatchFilter === 'all' || enrollment.batch_name === selectedBatchFilter) &&
                (selectedSubjectFilter === 'all' || enrollment.subject_name === selectedSubjectFilter)
            );

        if (activeEnrollments.length > 0) {
            const orFilterString = activeEnrollments
                .map(e => `and(batch.eq.${e.batch_name},subject.eq.${e.subject_name})`)
                .join(',');
            query = query.or(orFilterString);
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

  useEffect(() => {
    if (!profile?.user_id) return;
    const dppChannel = supabase
      .channel('dpp-realtime-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dpp_content' }, () => {
          queryClient.invalidateQueries({ queryKey: ['student-dpp'] });
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_enrollments', filter: `user_id=eq.${profile.user_id}` }, () => {
          queryClient.invalidateQueries({ queryKey: ['userEnrollments'] });
        })
      .subscribe();
    return () => { supabase.removeChannel(dppChannel); };
  }, [profile?.user_id, queryClient]);

  const filteredAndSearchedContent = useMemo(() => {
    if (!dppContent) return [];
    return dppContent.filter(item => 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [dppContent, searchTerm]);

  const handleAccessDPP = (dpp: DPPContent) => {
    window.open(dpp.link, '_blank');
  };
  
  const isLoading = isLoadingEnrollments || isLoadingDPPContent;

  if (selectedDPP) {
    return <DPPViewer dpp={selectedDPP} onBack={() => setSelectedDPP(null)} onDownload={handleAccessDPP} allDPPs={dppContent || []} onDPPSelect={setSelectedDPP} />;
  }

  return (
    <div className="p-6 space-y-8 bg-gray-50/50 min-h-full">
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

      <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search DPP content..."
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

      <div>
        {isLoading ? (
          <DPPSkeleton />
        ) : filteredAndSearchedContent && filteredAndSearchedContent.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredAndSearchedContent.map((dpp) => (
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
                    onClick={() => setSelectedDPP(dpp)}
                    className="w-full mt-5"
                    variant="outline"
                    >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Preview
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
