import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Video, Play, Search, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';


// Interfaces
interface RecordingContent {
  id: string;
  date: string;
  subject: string;
  topic: string;
  embed_link: string;
  batch: string;
  created_at: string;
}

interface UserEnrollment {
    batch_name: string;
    subject_name: string;
}

// Skeleton for the main list view
const RecordingListSkeleton = () => (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden bg-white shadow-lg rounded-xl">
                <Skeleton className="h-40 w-full" />
                <div className="p-4 space-y-3">
                    <Skeleton className="h-5 w-4/5 rounded-md" />
                    <Skeleton className="h-4 w-1/2 rounded-md" />
                    <div className="flex gap-2 pt-2">
                        <Skeleton className="h-5 w-20 rounded-full" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                </div>
            </Card>
        ))}
    </div>
);

// The main component for the recordings page
export const StudentRecordings = () => {
    const { profile } = useAuth();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');
    const [selectedBatchFilter, setSelectedBatchFilter] = useState('all');
    const [selectedRecording, setSelectedRecording] = useState<RecordingContent | null>(null);

    // Fetch user enrollments to determine which recordings to show
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
    
    // Logic for cascading filters
    const displayedBatches = useMemo(() => {
        if (!userEnrollments) return [];
        if (selectedSubjectFilter === 'all') return Array.from(new Set(userEnrollments.map(e => e.batch_name))).sort();
        return Array.from(new Set(userEnrollments.filter(e => e.subject_name === selectedSubjectFilter).map(e => e.batch_name))).sort();
    }, [userEnrollments, selectedSubjectFilter]);

    const displayedSubjects = useMemo(() => {
        if (!userEnrollments) return [];
        if (selectedBatchFilter !== 'all') return Array.from(new Set(userEnrollments.filter(e => e.batch_name === selectedBatchFilter).map(e => e.subject_name))).sort();
        return Array.from(new Set(userEnrollments.map(e => e.subject_name))).sort();
    }, [userEnrollments, selectedBatchFilter]);

    useEffect(() => {
        if (selectedBatchFilter !== 'all' && !displayedBatches.includes(selectedBatchFilter)) setSelectedBatchFilter('all');
    }, [selectedBatchFilter, displayedBatches]);

    useEffect(() => {
        if (selectedSubjectFilter !== 'all' && !displayedSubjects.includes(selectedSubjectFilter)) setSelectedSubjectFilter('all');
    }, [selectedSubjectFilter, displayedSubjects]);

    // Fetch the recordings based on enrollments and filters
    const { data: recordings, isLoading: isLoadingRecordingsContent } = useQuery<RecordingContent[]>({
        queryKey: ['student-recordings', userEnrollments, selectedBatchFilter, selectedSubjectFilter],
        queryFn: async (): Promise<RecordingContent[]> => {
            if (!userEnrollments || userEnrollments.length === 0) return [];
            let query = supabase.from('recordings').select('*');
            const combinationFilters = userEnrollments
                .filter(e => (selectedBatchFilter === 'all' || e.batch_name === selectedBatchFilter) && (selectedSubjectFilter === 'all' || e.subject_name === selectedSubjectFilter))
                .map(e => `and(batch.eq.${e.batch_name},subject.eq.${e.subject_name})`);
            if (combinationFilters.length > 0) query = query.or(combinationFilters.join(','));
            else return [];
            const { data, error } = await query.order('date', { ascending: false });
            if (error) throw error;
            return (data || []) as RecordingContent[];
        },
        enabled: !!userEnrollments && userEnrollments.length > 0
    });

    // Client-side search filtering
    const filteredRecordings = useMemo(() => recordings?.filter(rec =>
        rec.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.subject.toLowerCase().includes(searchTerm.toLowerCase())
    ), [recordings, searchTerm]);

    const isLoading = isLoadingEnrollments || isLoadingRecordingsContent;
    
    // Main view with the list of recordings
    return (
    <>
    <div className="p-6 space-y-8 bg-gray-50/50 min-h-full">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 flex items-center">
          <Video className="mr-3 h-8 w-8 text-primary" />
          Class Recordings
        </h1>
        <p className="text-gray-500 mt-1">Review past lectures and catch up on missed classes.</p>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search recordings..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-10"/>
        </div>
        <Select value={selectedBatchFilter} onValueChange={setSelectedBatchFilter}>
          <SelectTrigger className="w-48 h-10"><SelectValue placeholder="Filter by batch" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Batches</SelectItem>
            {displayedBatches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedSubjectFilter} onValueChange={setSelectedSubjectFilter}>
          <SelectTrigger className="w-48 h-10"><SelectValue placeholder="Filter by subject" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {displayedSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        {isLoading ? <RecordingListSkeleton /> : (
          filteredRecordings && filteredRecordings.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredRecordings.map((recording) => (
                <Card key={recording.id} className="bg-white hover:shadow-xl transition-shadow duration-300 rounded-2xl overflow-hidden group cursor-pointer" onClick={() => setSelectedRecording(recording)}>
                    <div className="h-40 bg-slate-800 flex items-center justify-center relative">
                        <Play className="h-12 w-12 text-white/70 group-hover:text-white group-hover:scale-110 transition-transform duration-300"/>
                    </div>
                  <CardContent className="p-4">
                      <h3 className="font-semibold text-gray-800 truncate group-hover:text-primary transition-colors">{recording.topic}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{format(new Date(recording.date), 'PPP')}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Badge variant="outline">{recording.subject}</Badge>
                        <Badge variant="secondary">{recording.batch}</Badge>
                      </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-lg border-dashed border-2">
              <Video className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700">No Recordings Found</h3>
              <p className="text-muted-foreground mt-2">Check back later or adjust your filters.</p>
            </div>
          )
        )}
      </div>
    </div>
    {selectedRecording && (
        <Dialog open={!!selectedRecording} onOpenChange={() => setSelectedRecording(null)}>
            <DialogContent className="max-w-4xl h-[80vh]">
                <iframe
                    src={selectedRecording.embed_link.replace('/view', '/preview')}
                    className="w-full h-full"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={selectedRecording.topic}
                />
            </DialogContent>
        </Dialog>
    )}
    </>
  );
};
