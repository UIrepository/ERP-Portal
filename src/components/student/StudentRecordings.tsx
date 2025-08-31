// uirepository/teachgrid-hub/teachgrid-hub-403387c9730ea8d229bbe9118fea5f221ff2dc6c/src/components/student/StudentRecordings.tsx
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Video, Play, Search, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Video, Play, Search, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

// Interfaces
interface RecordingContent {
id: string;
date: string;
@@ -28,282 +27,226 @@ interface UserEnrollment {
subject_name: string;
}

const RecordingSkeleton = () => (
// Skeleton for the main list view
const RecordingListSkeleton = () => (
<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
        {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden bg-white shadow-lg rounded-xl">
<Skeleton className="h-40 w-full" />
<div className="p-4 space-y-3">
                    <Skeleton className="h-5 w-4/5" />
                    <Skeleton className="h-4 w-1/2" />
                    <div className="flex gap-2">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-5 w-20" />
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
            return [];
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
// Component for the watermarked video player
const WatermarkedPlayer = ({ recording }: { recording: RecordingContent }) => {
    const { profile } = useAuth();
    return (
        <div className="relative aspect-video" onContextMenu={(e) => e.preventDefault()}>
            <iframe
                src={recording.embed_link}
                className="absolute top-0 left-0 w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={recording.topic}
            />
            <div className="absolute top-2 left-2 bg-black/50 text-white/80 text-xs px-2 py-1 rounded-full pointer-events-none backdrop-blur-sm">
                {profile?.email}
            </div>
             <div className="absolute bottom-2 right-2 pointer-events-none">
                <img src="/logoofficial.png" alt="Logo" className="h-10 w-auto opacity-40" />
            </div>
        </div>
    );
};

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
  };

  const handleWatchRecording = async (recording: any) => {
    await logActivity('recording_watch', `Watched ${recording.topic}`, {
      subject: recording.subject,
      recordingId: recording.id,
      topic: recording.topic
    
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
  };

  const WatermarkedPlayer = ({ recording }: { recording: any }) => (
    <div
      className="relative aspect-video"
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'I') e.preventDefault();
        if (e.ctrlKey && e.shiftKey && e.key === 'C') e.preventDefault();
        if (e.ctrlKey && e.shiftKey && e.key === 'J') e.preventDefault();
        if (e.ctrlKey && e.key === 'U') e.preventDefault();
        if (e.key === 'F12') e.preventDefault();
      }}
    >
      <iframe
        src={recording.embed_link}
        className="absolute top-0 left-0 w-full h-full rounded-lg"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title={recording.topic}
      />
      <div className="absolute top-2 left-2 bg-black/30 text-white/80 text-xs px-2 py-1 rounded pointer-events-none backdrop-blur-sm">
        {profile?.email}
      </div>
      <div className="absolute bottom-2 right-2 pointer-events-none">
        <img src="/imagelogo.png" alt="Logo" className="h-10 w-auto opacity-50" />
      </div>
    </div>
  );
    // Client-side search filtering
    const filteredRecordings = useMemo(() => recordings?.filter(rec =>
        rec.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.subject.toLowerCase().includes(searchTerm.toLowerCase())
    ), [recordings, searchTerm]);

  const isLoading = isLoadingEnrollments || isLoadingRecordingsContent;
    const isLoading = isLoadingEnrollments || isLoadingRecordingsContent;
    
    // If a recording is selected, render the player view
    if (selectedRecording) {
        const upNextRecordings = recordings?.filter(rec => rec.id !== selectedRecording.id).slice(0, 10) || [];
        return (
            <div className="p-4 md:p-6 space-y-6 bg-slate-100 min-h-full">
                <Button variant="outline" onClick={() => setSelectedRecording(null)} className="mb-4">
                    <ArrowLeft className="h-4 w-4 mr-2"/>
                    Back to Recordings
                </Button>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card className="bg-black rounded-2xl overflow-hidden shadow-2xl">
                            <CardContent className="p-0">
                                <WatermarkedPlayer recording={selectedRecording} />
                            </CardContent>
                        </Card>
                         <div className="mt-6">
                            <h1 className="text-2xl font-bold text-slate-800">{selectedRecording.topic}</h1>
                            <div className="flex items-center gap-4 text-slate-500 mt-2">
                               <span>{format(new Date(selectedRecording.date), 'PPP')}</span>
                               <Badge variant="secondary">{selectedRecording.batch}</Badge>
                               <Badge variant="outline">{selectedRecording.subject}</Badge>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-slate-700">Up Next</h2>
                         {upNextRecordings.map(rec => (
                             <Card key={rec.id} className="p-3 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setSelectedRecording(rec)}>
                                 <div className="flex gap-4 items-center">
                                     <div className="w-24 h-16 bg-slate-200 rounded-md flex-shrink-0 relative">
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                            <Play className="h-6 w-6 text-white"/>
                                        </div>
                                     </div>
                                     <div>
                                         <p className="font-semibold text-sm line-clamp-2">{rec.topic}</p>
                                         <p className="text-xs text-slate-500">{rec.subject}</p>
                                     </div>
                                 </div>
                             </Card>
                         ))}
                    </div>
                </div>
            </div>
        )
    }

  return (
    // Main view with the list of recordings
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
      <div>
        <h1 className="text-3xl font-bold text-gray-800 flex items-center">
          <Video className="mr-3 h-8 w-8 text-primary" />
          Class Recordings
        </h1>
        <p className="text-gray-500 mt-1">Review past lectures and catch up on missed classes.</p>
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
          <Input placeholder="Search recordings..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-10"/>
</div>
<Select value={selectedBatchFilter} onValueChange={setSelectedBatchFilter}>
          <SelectTrigger className="w-48 h-10">
            <SelectValue placeholder="Filter by batch" />
          </SelectTrigger>
          <SelectTrigger className="w-48 h-10"><SelectValue placeholder="Filter by batch" /></SelectTrigger>
<SelectContent>
<SelectItem value="all">All Batches</SelectItem>
            {displayedBatches.map((batch) => (
              <SelectItem key={batch} value={batch}>{batch}</SelectItem>
            ))}
            {displayedBatches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
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
        <Select value={selectedSubjectFilter} onValueChange={setSelectedSubjectFilter}>
          <SelectTrigger className="w-48 h-10"><SelectValue placeholder="Filter by subject" /></SelectTrigger>
<SelectContent>
<SelectItem value="all">All Subjects</SelectItem>
            {displayedSubjects.map((subject) => (
              <SelectItem key={subject} value={subject}>{subject}</SelectItem>
            ))}
            {displayedSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
        {isLoading ? <RecordingListSkeleton /> : (
          filteredRecordings && filteredRecordings.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredRecordings.map((recording) => (
                <Card key={recording.id} className="bg-white hover:shadow-xl transition-shadow duration-300 rounded-2xl overflow-hidden group cursor-pointer" onClick={() => setSelectedRecording(recording)}>
                    <div className="h-40 bg-slate-800 flex items-center justify-center relative">
                        <Play className="h-12 w-12 text-white/70 group-hover:text-white group-hover:scale-110 transition-transform duration-300"/>
</div>
                    <DialogTrigger asChild>
                      <Button onClick={() => handleWatchRecording(recording)} className="w-full mt-5">
                        <Play className="h-4 w-4 mr-2" />
                        Watch Recording
                      </Button>
                    </DialogTrigger>
                  <CardContent className="p-4">
                      <h3 className="font-semibold text-gray-800 truncate group-hover:text-primary transition-colors">{recording.topic}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{format(new Date(recording.date), 'PPP')}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Badge variant="outline">{recording.subject}</Badge>
                        <Badge variant="secondary">{recording.batch}</Badge>
                      </div>
</CardContent>
</Card>
                <DialogContent className="max-w-4xl p-0 border-0">
                  <DialogHeader className="sr-only">
                    <DialogTitle>{recording.topic}</DialogTitle>
                    <DialogDescription>
                      Class recording for {recording.subject} on {format(new Date(recording.date), 'PPP')}.
                    </DialogDescription>
                  </DialogHeader>
                  <WatermarkedPlayer recording={recording} />
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
