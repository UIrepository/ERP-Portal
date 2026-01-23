import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, X, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface JitsiMeetingProps {
  roomName: string;
  displayName: string;
  subject: string;
  batch: string;
  scheduleId: string | null;
  onClose: () => void;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

const CONNECTION_TIMEOUT_MS = 30000; // 30 seconds

export const JitsiMeeting = ({ 
  roomName, 
  displayName, 
  subject, 
  batch, 
  scheduleId, 
  onClose 
}: JitsiMeetingProps) => {
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  const { profile, resolvedRole } = useAuth();
  const joinTimeRef = useRef<Date | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Record attendance when joining
  const recordAttendance = async () => {
    if (!profile?.user_id) return;
    
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      await supabase.from('class_attendance').upsert({
        user_id: profile.user_id,
        user_name: displayName || profile.name,
        user_role: resolvedRole,
        schedule_id: scheduleId,
        batch,
        subject,
        class_date: today,
        joined_at: new Date().toISOString()
      }, { 
        onConflict: 'user_id,schedule_id,class_date'
      });
      
      joinTimeRef.current = new Date();
      toast.success('You have joined the class');
    } catch (error) {
      console.error('Error recording attendance:', error);
    }
  };

  // Update attendance when leaving
  const updateAttendanceOnLeave = async () => {
    if (!profile?.user_id || !joinTimeRef.current) return;
    
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const durationMs = new Date().getTime() - joinTimeRef.current.getTime();
      const durationMinutes = Math.round(durationMs / 60000);
      
      await supabase.from('class_attendance')
        .update({ 
          left_at: new Date().toISOString(),
          duration_minutes: durationMinutes
        })
        .eq('user_id', profile.user_id)
        .eq('class_date', today)
        .eq('batch', batch)
        .eq('subject', subject);
    } catch (error) {
      console.error('Error updating attendance on leave:', error);
    }
  };

  const initializeJitsi = () => {
    if (!jitsiContainerRef.current) {
      console.error('Jitsi container not found');
      setConnectionError(true);
      setIsLoading(false);
      return;
    }

    if (!window.JitsiMeetExternalAPI) {
      console.error('Jitsi API not loaded');
      toast.error('Video conferencing failed to load. Please refresh the page.');
      setConnectionError(true);
      setIsLoading(false);
      return;
    }

    // Clear any existing timeout
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }

    // Set connection timeout
    connectionTimeoutRef.current = setTimeout(() => {
      if (isLoading) {
        console.error('Jitsi connection timeout');
        setIsLoading(false);
        setConnectionError(true);
        toast.error('Connection timed out. Please try again.');
      }
    }, CONNECTION_TIMEOUT_MS);

    const domain = 'meet.jit.si';
    const sanitizedRoomName = `teachgrid-${roomName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()}`;
    
    const options = {
      roomName: sanitizedRoomName,
      width: '100%',
      height: '100%',
      parentNode: jitsiContainerRef.current,
      userInfo: {
        displayName: displayName
      },
      configOverwrite: {
        prejoinPageEnabled: false,
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        disableDeepLinking: true,
        disableInviteFunctions: true,
      },
      interfaceConfigOverwrite: {
        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'desktop', 'chat',
          'raisehand', 'participants-pane', 'tileview', 'fullscreen'
        ],
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        DEFAULT_REMOTE_DISPLAY_NAME: 'Participant',
        MOBILE_APP_PROMO: false,
        DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
      }
    };

    try {
      apiRef.current = new window.JitsiMeetExternalAPI(domain, options);

      apiRef.current.addEventListeners({
        videoConferenceJoined: () => {
          // Clear timeout on successful connection
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
          }
          setIsLoading(false);
          setConnectionError(false);
          recordAttendance();
        },
        videoConferenceLeft: () => {
          updateAttendanceOnLeave();
        },
        readyToClose: () => {
          updateAttendanceOnLeave();
          onClose();
        },
        audioMuteStatusChanged: ({ muted }: { muted: boolean }) => setIsAudioMuted(muted),
        videoMuteStatusChanged: ({ muted }: { muted: boolean }) => setIsVideoMuted(muted),
      });

      // Set subject as meeting title
      if (subject) {
        apiRef.current.executeCommand('subject', `${subject} - ${batch}`);
      }
    } catch (error) {
      console.error('Error initializing Jitsi:', error);
      toast.error('Failed to start video meeting');
      setConnectionError(true);
      setIsLoading(false);
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    }
  };

  useEffect(() => {
    setIsLoading(true);
    setConnectionError(false);
    initializeJitsi();

    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      if (apiRef.current) {
        updateAttendanceOnLeave();
        apiRef.current.dispose();
      }
    };
  }, [roomName, displayName, subject, batch]);

  const handleRetry = () => {
    // Dispose existing API if any
    if (apiRef.current) {
      apiRef.current.dispose();
      apiRef.current = null;
    }
    setIsLoading(true);
    setConnectionError(false);
    initializeJitsi();
  };

  const toggleAudio = () => apiRef.current?.executeCommand('toggleAudio');
  const toggleVideo = () => apiRef.current?.executeCommand('toggleVideo');
  const toggleShareScreen = () => apiRef.current?.executeCommand('toggleShareScreen');
  const hangUp = () => {
    updateAttendanceOnLeave();
    apiRef.current?.executeCommand('hangup');
  };

  const handleClose = () => {
    updateAttendanceOnLeave();
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
    if (apiRef.current) {
      apiRef.current.dispose();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-gray-900/90 backdrop-blur p-4 flex justify-between items-center z-10">
        <div>
          <h2 className="text-white font-semibold">{subject}</h2>
          <p className="text-gray-300 text-sm">{batch}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="text-white hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && !connectionError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-white">Connecting to class...</p>
            <p className="text-gray-400 text-sm mt-2">This may take a few seconds</p>
          </div>
        </div>
      )}

      {/* Connection Error state */}
      {connectionError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-20">
          <div className="text-center">
            <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <X className="h-6 w-6 text-red-400" />
            </div>
            <p className="text-white text-lg font-semibold">Failed to connect to class</p>
            <p className="text-gray-400 text-sm mt-2 mb-6">
              Please check your internet connection and try again
            </p>
            <div className="flex gap-3 justify-center">
              <Button 
                onClick={handleRetry}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button 
                variant="ghost" 
                onClick={handleClose}
                className="text-gray-300 hover:text-white hover:bg-white/10"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Controls Bar */}
      {!connectionError && (
        <div className="absolute bottom-0 left-0 right-0 bg-gray-900/90 backdrop-blur p-4 flex justify-center gap-4 z-10">
          <Button
            variant={isAudioMuted ? "destructive" : "secondary"}
            size="lg"
            onClick={toggleAudio}
            className="rounded-full w-14 h-14"
            title={isAudioMuted ? "Unmute" : "Mute"}
          >
            {isAudioMuted ? <MicOff /> : <Mic />}
          </Button>
          
          <Button
            variant={isVideoMuted ? "destructive" : "secondary"}
            size="lg"
            onClick={toggleVideo}
            className="rounded-full w-14 h-14"
            title={isVideoMuted ? "Turn on camera" : "Turn off camera"}
          >
            {isVideoMuted ? <VideoOff /> : <Video />}
          </Button>
          
          <Button
            variant="secondary"
            size="lg"
            onClick={toggleShareScreen}
            className="rounded-full w-14 h-14"
            title="Share screen"
          >
            <MonitorUp />
          </Button>
          
          <Button
            variant="destructive"
            size="lg"
            onClick={hangUp}
            className="rounded-full w-14 h-14"
            title="Leave meeting"
          >
            <PhoneOff />
          </Button>
        </div>
      )}

      {/* Jitsi Container */}
      <div ref={jitsiContainerRef} className="flex-1 pt-16 pb-20" />
    </div>
  );
};