// uirepository/teachgrid-hub/teachgrid-hub-403387c9730ea8d229bbe9118fea5f221ff2dc6c/src/components/student/StudentRecordings.tsx
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Video, Play, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns'; // Corrected import: removed 's'
import { Skeleton } from '@/components/ui/skeleton';

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

const RecordingSkeleton = () => (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
                <Skeleton className="h-40 w-full" />
                <div className="p-4 space-y-3">
                    <Skeleton className="h-5 w-4/5" />
                    <Skeleton className="h-4 w-1/2" />
                    <div className="flex gap-2">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-5 w-20" />
                    </div>
                </div>
            </Card>
        ))}
    </div>
);

export const StudentRecordings = () => {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('all');

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
  if (selectedBatchFilter !== 'all' && !displayedBatches.includes(selectedBatchFilter)) {
      setSelectedBatchFilter('all');
  }
  if (selectedSubjectFilter !== 'all' && !displayedSubjects.includes(selectedSubjectFilter)) {
      setSelectedSubjectFilter('all');
  }

  const { data: recordings, isLoading: isLoadingRecordingsContent } = useQuery<RecordingContent[]>({
    queryKey: ['student-recordings', userEnrollments, selectedBatchFilter, selectedSubjectFilter],
    queryFn: async (): Promise<RecordingContent[]> => {
        if (!userEnrollments || userEnrollments.length === 0) return [];

        let query = supabase.from('recordings').select('*');

        const combinationFilters = userEnrollments
            .filter(enrollment =>
                (selectedBatchFilter === 'all' || enrollment.batch_name === selectedBatchFilter) &&
                (selectedSubjectFilter === 'all' || enrollment.subject_name === selectedSubjectFilter)
            )
            .map(enrollment => `and(batch.eq.${enrollment.batch_name},subject.eq.${enrollment.subject_name})`);

        if (combinationFilters.length > 0) {
            query = query.or(combinationFilters.join(','));
        } else {
            return []; // Return empty if no combinations match filters
        }
        
        query = query.order('date', { ascending: false });

        const { data, error } = await query;
      
        if (error) {
            console.error("Error fetching filtered Recording content:", error);
            throw error;
        }
        return (data || []) as RecordingContent[];
    },
    enabled: !!userEnrollments && userEnrollments.length > 0
  });

  const filteredRecordings = recordings?.filter(recording => {
    const matchesSearch = !searchTerm || 
      recording.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recording.subject.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const logActivity = async (activityType: string, description: string, metadata?: any) => {
    if (!profile?.user_id) return;
    
    const availableBatchesForLog = Array.from(new Set(userEnrollments?.map(e => e.batch_name) || []));
    await supabase.from('student_activities').insert({
      user_id: profile.user_id,
      activity_type: activityType,
      description,
      metadata,
      batch: availableBatchesForLog.length > 0 ? availableBatchesForLog[0] : null,
      subject: metadata.subject,
    });
  };

  const handleWatchRecording = async (recording: any) => {
    await logActivity('recording_watch', `Watched ${recording.topic}`, {
      subject: recording.subject,
      recordingId: recording.id,
      topic: recording.topic
    });
  };

  const WatermarkedPlayer = ({ recording }: { recording: any }) => (
    <div className="relative aspect-video">
        <iframe
        src={recording.embed_link}
        className="absolute top-0 left-0 w-full h-full rounded-lg"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        />
        <div className="absolute top-2 right-2 bg-black/30 text-white/80 text-xs px-2 py-1 rounded pointer-events-none backdrop-blur-sm">
        {profile?.name} - {profile?.email}
        </div>
    </div>
  );

  const isLoading = isLoadingEnrollments || isLoadingRecordingsContent;

  return (
    <div className="p-6 space-y-8 bg-gray-50/50 min-h-full">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            <Video className="mr-3 h-8 w-8 text-primary" />
            Class Recordings
          </h1>
          <p className="text-gray-500 mt-1">Review past lectures and catch up on missed classes.</p>
        </div>
        <div className="flex gap-2">
          {/* Display all enrolled batches */}
          {displayedBatches.map(b => <Badge key={b} variant="outline">{b}</Badge>)}
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search recordings by topic..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
          disabled={selectedBatchFilter === 'all'} // Subject filter disabled if 'All Batches' is selected
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

      {/* Recordings Grid */}
      <div>
        {isLoading ? (
          <RecordingSkeleton />
        ) : filteredRecordings && filteredRecordings.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredRecordings.map((recording) => (
              <Dialog key={recording.id}>
                <Card className="bg-white hover:shadow-lg transition-shadow duration-300">
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex-grow">
                      <div className="flex items-start gap-4">
                        <div className="bg-primary/10 p-2 rounded-full">
                          <Video className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-800 truncate">{recording.topic}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {format(new Date(recording.date), 'PPP')}
                          </p>
                          <div className="flex gap-2 mt-3">
                            <Badge variant="outline">{recording.subject}</Badge>
                            <Badge variant="secondary">{recording.batch}</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button onClick={() => handleWatchRecording(recording)} className="w-full mt-5">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Watch Recording
                    </Button>
                  </CardContent>
                </Card>
                <DialogContent className="max-w-4xl p-0 border-0">
                  {/* WatermarkedPlayer component definition */}
                  <div className="relative aspect-video">
                      <iframe
                      src={recording.embed_link}
                      className="absolute top-0 left-0 w-full h-full rounded-lg"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      />
                      <div className="absolute top-2 right-2 bg-black/30 text-white/80 text-xs px-2 py-1 rounded pointer-events-none backdrop-blur-sm">
                      {profile?.name} - {profile?.email}
                      </div>
                  </div>
                </DialogContent>
              </Dialog>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-lg border-dashed border-2">
            <Video className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700">No Recordings Found</h3>
            <p className="text-muted-foreground mt-2">Check back later or adjust your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};
