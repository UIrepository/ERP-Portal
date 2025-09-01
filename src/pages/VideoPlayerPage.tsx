import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Maximize, Minimize, Video } from 'lucide-react';
import { format } from 'date-fns';
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

const UpNextSkeleton = () => (
    <div className="p-2 space-y-2">
        {[...Array(5)].map((_, i) => (
            <div key={i} className="p-2 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-1/2" />
            </div>
        ))}
    </div>
);


export const VideoPlayerPage = () => {
  const { recordingId } = useParams();
  const navigate = useNavigate();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { data: recording, isLoading: isLoadingRecording, isError, error } = useQuery<RecordingContent | null>({
    queryKey: ['recording', recordingId],
    queryFn: async () => {
      if (!recordingId) return null;
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('id', recordingId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!recordingId,
  });

  const { data: upNextRecordings, isLoading: isLoadingUpNext } = useQuery<RecordingContent[]>({
    queryKey: ['upNextRecordings', recording?.subject, recording?.batch],
    queryFn: async () => {
      if (!recording) return [];
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('subject', recording.subject)
        .eq('batch', recording.batch)
        .neq('id', recording.id)
        .order('date', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!recording,
  });

  const toggleFullscreen = () => {
    const elem = document.getElementById('video-player-wrapper');
    if (!elem) return;

    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(err => {
        alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen();
    }
  };
  
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);


  if (isLoadingRecording) {
    return (
        <div className="flex h-screen bg-slate-100">
            <div className="flex-1 flex flex-col">
                <header className="bg-white border-b p-4 flex justify-between items-center">
                    <Skeleton className="h-10 w-48" />
                    <Skeleton className="h-10 w-32" />
                </header>
                <main className="flex-1 bg-black" />
            </div>
            <aside className="w-80 border-l bg-white overflow-y-auto">
                <div className="p-4 border-b">
                    <h2 className="font-semibold text-lg">Up Next</h2>
                </div>
                <UpNextSkeleton />
            </aside>
        </div>
    );
  }

  if (isError || !recording) {
    return (
        <div className="min-h-screen flex items-center justify-center text-center">
            <div>
                <h2 className="text-2xl font-bold text-destructive">Could not load recording</h2>
                <p className="text-muted-foreground">{error?.message || "The recording you are looking for does not exist."}</p>
                <Button onClick={() => navigate(-1)} className="mt-4">Go Back</Button>
            </div>
        </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 flex-col lg:flex-row">
      <div id="video-player-wrapper" className="flex-1 flex flex-col bg-black">
        <header className="bg-white border-b p-4 flex justify-between items-center flex-shrink-0">
          <Button variant="ghost" onClick={() => navigate('/?tab=recordings')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Recordings
          </Button>
          <div className="text-center">
            <h1 className="text-xl font-semibold">{recording.topic}</h1>
            <div className="text-sm text-muted-foreground">
                <span>{recording.subject}</span> - <span>{recording.batch}</span>
            </div>
          </div>
          <Button variant="outline" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize className="mr-2 h-4 w-4" /> : <Maximize className="mr-2 h-4 w-4" />}
            <span className="hidden md:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </Button>
        </header>
        <main className="flex-1 relative">
          <iframe
            id="video-iframe"
            src={recording.embed_link.replace('/view', '/preview')}
            className="w-full h-full absolute top-0 left-0"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={recording.topic}
          />
        </main>
      </div>
      <aside className="w-full lg:w-96 border-l bg-white overflow-y-auto flex-shrink-0 h-1/3 lg:h-full">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg">Up Next in {recording.subject}</h2>
        </div>
        <div className="p-2 space-y-1">
            {isLoadingUpNext 
            ? <UpNextSkeleton /> 
            : upNextRecordings?.map(rec => (
                <Link to={`/recordings/${rec.id}`} key={rec.id} className="w-full text-left p-2 rounded-md hover:bg-slate-100 transition-colors block">
                    <div className="flex items-start gap-3">
                        <div className="bg-slate-200 rounded-md w-24 h-16 flex items-center justify-center flex-shrink-0">
                            <Video className="h-6 w-6 text-slate-500"/>
                        </div>
                        <div>
                            <p className="font-semibold text-sm leading-tight line-clamp-2">{rec.topic}</p>
                            <p className="text-xs text-muted-foreground mt-1">{format(new Date(rec.date), 'PPP')}</p>
                        </div>
                    </div>
                </Link>
            ))}
        </div>
      </aside>
    </div>
  );
};
