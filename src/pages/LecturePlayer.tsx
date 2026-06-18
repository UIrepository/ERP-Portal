/**
 * Standalone Lecture Player Page
 * Opens in a new tab. Loads recording + sibling lectures + doubts,
 * then renders the FullScreenVideoPlayer.
 */
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { FullScreenVideoPlayer } from '@/components/video-player';
import { Lecture, Doubt as PlayerDoubt } from '@/components/video-player/types';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { saveProgress, getResumeSeconds } from '@/lib/videoProgress';
import { useDriveSync } from '@/hooks/useDriveSync';
import { isDriveConnected, hasValidToken, pushToDrive, syncWithDrive } from '@/lib/driveProgressSync';

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

  // --- Drive cross-device sync (opt-in via on-leave dialog) ---
  const watchedRef = useRef(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingAfterConnectRef = useRef(false);
  const [saveDialog, setSaveDialog] = useState<null | 'ask' | 'connecting'>(null);

  const { connect } = useDriveSync({
    userId: user?.id,
    onDone: (ok) => {
      setSaveDialog(null);
      if (ok) toast({ title: 'Synced', description: 'Your progress will now follow you across devices.' });
      if (closingAfterConnectRef.current) {
        closingAfterConnectRef.current = false;
        finishClose();
      }
    },
  });

  // Same-session pull (e.g. another tab updated Drive). No popup — only runs if a
  // valid token is already in memory.
  useEffect(() => {
    if (user && isDriveConnected() && hasValidToken()) {
      syncWithDrive(user.id).catch(() => { /* keep local */ });
    }
  }, [user?.id]);

  // Clean up the debounced push timer.
  useEffect(() => () => { if (pushTimerRef.current) clearTimeout(pushTimerRef.current); }, []);

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
      watchedRef.current = true;
      // If Drive is connected and we have a live token, debounce a push.
      if (isDriveConnected() && hasValidToken()) {
        if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
        pushTimerRef.current = setTimeout(() => { if (user) pushToDrive(user.id); }, 20000);
      }
    },
    [user, currentRecording]
  );

  // Where to resume this lecture from (captured per lecture id).
  const resumeAt = useMemo(
    () => (user && currentId ? getResumeSeconds(user.id, currentId) : 0),
    [user, currentId]
  );

  const finishClose = useCallback(() => {
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    if (user && isDriveConnected() && hasValidToken()) pushToDrive(user.id);
    // Try to close the tab; if blocked, navigate home
    window.close();
    setTimeout(() => navigate('/'), 100);
  }, [user, navigate]);

  const handleClose = useCallback(() => {
    const dismissed = sessionStorage.getItem('ui_video_save_dismissed') === '1';
    // First time on this device + actually watched + not connected → offer to
    // save progress across devices before leaving.
    if (watchedRef.current && !isDriveConnected() && !dismissed) {
      setSaveDialog('ask');
      return;
    }
    finishClose();
  }, [finishClose]);

  const handleGivePermission = useCallback(() => {
    closingAfterConnectRef.current = true;
    setSaveDialog('connecting');
    connect();
  }, [connect]);

  const handleNotNow = useCallback(() => {
    try { sessionStorage.setItem('ui_video_save_dismissed', '1'); } catch { /* ignore */ }
    setSaveDialog(null);
    finishClose();
  }, [finishClose]);

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
    <>
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

      {saveDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 text-white shadow-2xl">
            <h3 className="text-lg font-semibold">Save your progress?</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Connect Google Drive to pick up where you left off on any device.
              We only keep a tiny progress file in your own Drive — nothing else,
              and you can disconnect anytime.
            </p>
            {saveDialog === 'connecting' ? (
              <div className="mt-6 flex items-center justify-center gap-3 text-white/80">
                <Loader2 className="h-5 w-5 animate-spin" /> Connecting…
              </div>
            ) : (
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleNotNow}
                  className="rounded-lg px-4 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                >
                  Not now
                </button>
                <button
                  type="button"
                  onClick={handleGivePermission}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors"
                >
                  Give permission
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default LecturePlayer;
