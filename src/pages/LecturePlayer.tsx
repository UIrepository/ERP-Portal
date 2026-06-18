/**
 * Standalone Lecture Player Page
 * Opens in a new tab. Loads recording + sibling lectures + doubts,
 * then renders the FullScreenVideoPlayer.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { FullScreenVideoPlayer } from '@/components/video-player';
import { Lecture, Doubt as PlayerDoubt } from '@/components/video-player/types';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { saveProgress, getResumeSeconds } from '@/lib/videoProgress';

interface RecordingRow {
  id: string;
  date: string;
  subject: string;
  topic: string;
  embed_link: string;
  batch: string;
  created_at: string;
}

const LecturePlayer = () => {
  const { recordingId } = useParams();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [currentId, setCurrentId] = useState<string | undefined>(recordingId);

  useEffect(() => {
    setCurrentId(recordingId);
  }, [recordingId]);

  // Load the recording row to discover batch/subject
  const { data: currentRecording, isLoading: loadingCurrent } = useQuery<RecordingRow | null>({
    queryKey: ['lecture-player-recording', currentId],
    queryFn: async () => {
      if (!currentId) return null;
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('id', currentId)
        .maybeSingle();
      if (error) throw error;
      return (data as RecordingRow) || null;
    },
    enabled: !!currentId && !authLoading && !!user,
  });

  // Load all sibling lectures (same batch+subject), sorted newest first
  const { data: siblings = [] } = useQuery<RecordingRow[]>({
    queryKey: ['lecture-player-siblings', currentRecording?.batch, currentRecording?.subject],
    queryFn: async () => {
      if (!currentRecording) return [];
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .eq('batch', currentRecording.batch)
        .eq('subject', currentRecording.subject)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as RecordingRow[]) || [];
    },
    enabled: !!currentRecording,
  });

  const allLectures: Lecture[] = useMemo(
    () =>
      siblings.map((rec) => ({
        id: rec.id,
        title: rec.topic,
        subject: rec.subject,
        videoUrl: rec.embed_link,
        isCompleted: false,
      })),
    [siblings]
  );

  const playerLecture: Lecture | null = useMemo(() => {
    if (!currentRecording) return null;
    return {
      id: currentRecording.id,
      title: currentRecording.topic,
      subject: currentRecording.subject,
      videoUrl: currentRecording.embed_link,
      isCompleted: false,
    };
  }, [currentRecording]);

  // Doubts for the current lecture
  const { data: playerDoubts = [] } = useQuery({
    queryKey: ['player-doubts', currentId],
    queryFn: async () => {
      if (!currentId) return [];
      const { data: doubtsData, error } = await supabase
        .from('doubts')
        .select(`id, question_text, created_at, user_id, profiles!inner(name)`)
        .eq('recording_id', currentId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const doubtIds = (doubtsData || []).map((d: any) => d.id);
      let answersData: any[] = [];
      if (doubtIds.length > 0) {
        const { data: ans } = await supabase
          .from('doubt_answers')
          .select(`id, answer_text, created_at, user_id, doubt_id, profiles!inner(name)`)
          .in('doubt_id', doubtIds)
          .order('created_at', { ascending: true });
        answersData = ans || [];
      }

      return (doubtsData || []).map((doubt: any): PlayerDoubt => {
        const answer = answersData.find((a: any) => a.doubt_id === doubt.id);
        return {
          id: doubt.id,
          question: doubt.question_text,
          askedBy: doubt.profiles?.name || 'A student',
          askedAt: new Date(doubt.created_at),
          answer: answer?.answer_text,
          answeredBy: answer?.profiles?.name,
          answeredAt: answer ? new Date(answer.created_at) : undefined,
        };
      });
    },
    enabled: !!currentId,
  });

  const handleLectureChange = useCallback(
    (lecture: Lecture) => {
      setCurrentId(lecture.id);
      // Update the URL without a full reload
      window.history.replaceState(null, '', `/lecture/${lecture.id}`);
    },
    []
  );

  const handleDoubtSubmit = useCallback(
    async (question: string) => {
      if (!user || !currentRecording) return;
      const { error } = await supabase.from('doubts').insert({
        recording_id: currentRecording.id,
        user_id: user.id,
        question_text: question,
        batch: currentRecording.batch,
        subject: currentRecording.subject,
      });
      if (error) {
        toast({ title: 'Error posting question', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Your question has been posted.' });
        queryClient.invalidateQueries({ queryKey: ['player-doubts', currentRecording.id] });
      }
    },
    [user, currentRecording, queryClient]
  );

  // Persist watch progress on-device (localStorage) for the "Continue watching" strip.
  const handleProgress = useCallback(
    (seconds: number, duration: number) => {
      if (!user || !currentRecording) return;
      saveProgress(user.id, {
        videoId: currentRecording.id,
        title: currentRecording.topic,
        subject: currentRecording.subject,
        batch: currentRecording.batch,
        videoUrl: currentRecording.embed_link,
        seconds,
        duration,
      });
    },
    [user, currentRecording]
  );

  // Where to resume this lecture from (captured per lecture id).
  const resumeAt = useMemo(
    () => (user && currentId ? getResumeSeconds(user.id, currentId) : 0),
    [user, currentId]
  );

  const handleClose = useCallback(() => {
    // Try to close the tab; if blocked, navigate home
    window.close();
    setTimeout(() => navigate('/'), 100);
  }, [navigate]);

  if (authLoading || loadingCurrent || !playerLecture) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center text-white">
        Please log in to watch this lecture.
      </div>
    );
  }

  return (
    <FullScreenVideoPlayer
      currentLecture={playerLecture}
      lectures={allLectures}
      doubts={playerDoubts}
      onLectureChange={handleLectureChange}
      onDoubtSubmit={handleDoubtSubmit}
      onClose={handleClose}
      userName={profile?.name || user.email}
      onProgress={handleProgress}
      resumeAt={resumeAt}
    />
  );
};

export default LecturePlayer;
