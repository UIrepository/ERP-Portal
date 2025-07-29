import { useState } from 'react';
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
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

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
  const [selectedSubject, setSelectedSubject] = useState('all');

  const batches = Array.isArray(profile?.batch) ? profile.batch : [profile?.batch].filter(Boolean);

  const { data: recordings, isLoading } = useQuery({
    queryKey: ['student-recordings', batches, profile?.subjects],
    queryFn: async () => {
      if (!batches.length || !profile?.subjects) return [];
      const { data } = await supabase
        .from('recordings')
        .in('batch', batches)
        .in('subject', profile.subjects)
        .order('date', { ascending: false });
      return data || [];
    },
    enabled: !!profile?.batch && !!profile?.subjects
  });

  const filteredRecordings = recordings?.filter(recording => {
    const matchesSearch = !searchTerm || 
      recording.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recording.subject.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSubject = selectedSubject === 'all' || recording.subject === selectedSubject;
    
    return matchesSearch && matchesSubject;
  });

  const logActivity = async (activityType: string, description: string, metadata?: any) => {
    if (!profile?.user_id) return;
    
    await supabase.from('student_activities').insert({
      user_id: profile.user_id,
      activity_type: activityType,
      description,
      metadata,
      batch: batches.length > 0 ? batches[0] : null,
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
          <Badge variant="outline">Batches: {batches.join(', ')}</Badge>
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
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
          <SelectTrigger className="w-48 h-10">
            <SelectValue placeholder="Filter by subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {profile?.subjects?.map((subject) => (
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
                <Card className="bg-white hover:shadow-lg transition-shadow duration-300 flex flex-col group">
                  <div className="relative">
                    <div className="aspect-video bg-gray-200 rounded-t-lg flex items-center justify-center">
                      <Video className="h-12 w-12 text-gray-300" />
                    </div>
                    <DialogTrigger asChild>
                      <Button 
                        onClick={() => handleWatchRecording(recording)}
                        className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      >
                        <Play className="h-8 w-8 text-white" />
                      </Button>
                    </DialogTrigger>
                  </div>

                  <CardContent className="p-4 flex flex-col flex-grow">
                    <div className="flex-grow">
                      <h3 className="font-semibold text-gray-800 truncate">{recording.topic}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {format(new Date(recording.date), 'PPP')}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Badge variant="outline">{recording.subject}</Badge>
                        <Badge variant="secondary">{recording.batch}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <DialogContent className="max-w-4xl p-0 border-0">
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
        )}
      </div>
    </div>
  );
};
