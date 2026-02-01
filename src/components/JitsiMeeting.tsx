import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, MonitorUp, X, RefreshCw, AlertTriangle, Lock, Youtube, Loader2, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useYoutubeStream } from '@/hooks/useYoutubeStream';

// ✅ COMMUNITY SERVER (Unlimited Time, Embeddable)
const DOMAIN = 'meet.guifi.net'; 

interface JitsiMeetingProps {
  roomName: string;
  displayName: string;
  subject: string;
  batch: string;
  onClose: () => void;
  userRole?: 'teacher' | 'student' | 'admin' | 'manager';
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

export const JitsiMeeting = ({
  roomName,
  displayName,
  subject,
  batch,
  onClose,
  userRole = 'student',
}: JitsiMeetingProps) => {
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { startStream, isStreaming, isStartingStream } = useYoutubeStream();
  
  // 🔐 ROLE CHECK
  const isHost = userRole === 'teacher' || userRole === 'admin';

  // --- 1. TOOLBAR CONFIGURATION (The "Moderator Control" Fix) ---
  const TEACHER_TOOLBAR = [
      'microphone', 'camera', 'desktop', 'chat', 'raisehand', 
      'participants-pane', 'tileview', 'fullscreen', 'videoquality', 
      'filmstrip', 'settings', 'hangup', 'sharedvideo',
      'livestreaming', 'recording', 'mute-everyone', 'security', 'stats', 'select-background'
  ];

  // Students get a restricted toolbar (No Kick, No Mute Others, No Security options)
  const STUDENT_TOOLBAR = [
      'microphone', 'camera', 'desktop', 'chat', 'raisehand', 
      'participants-pane', 'tileview', 'fullscreen', 'videoquality', 
      'filmstrip', 'hangup', 'select-background' 
  ];

  // --- 2. LOAD JITSI SCRIPT ---
  useEffect(() => {
    const loadScript = async () => {
      if (window.JitsiMeetExternalAPI) {
        initializeJitsi();
        return;
      }
      const script = document.createElement('script');
      script.src = `https://${DOMAIN}/external_api.js`;
      script.async = true;
      script.onload = () => initializeJitsi();
      document.body.appendChild(script);
    };
    loadScript();
  }, []);

  // --- 3. INITIALIZE MEETING ---
  const initializeJitsi = () => {
    if (!jitsiContainerRef.current) return;

    const options = {
      roomName: roomName,
      width: '100%',
      height: '100%',
      parentNode: jitsiContainerRef.current,
      userInfo: { displayName },
      configOverwrite: {
        startWithAudioMuted: true,
        disableThirdPartyRequests: true,
        prejoinPageEnabled: false, // Instant Entry
        
        // 🔒 SECURITY: PREVENT STUDENTS FROM ACTING AS MODERATORS
        // Even if they join first, we hide the UI controls
        disableRemoteMute: !isHost, // Only Host can mute others
        remoteVideoMenu: {
            disableKick: !isHost,   // Only Host can kick
            disableGrantModerator: true,
            disablePrivateChat: false,
        },
        
        // Stability Settings
        enableLayerSuspension: true,
      },
      interfaceConfigOverwrite: {
        // Apply the Restricted Toolbar
        TOOLBAR_BUTTONS: isHost ? TEACHER_TOOLBAR : STUDENT_TOOLBAR,
        
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        DEFAULT_BACKGROUND: '#111827',
        TOOLBAR_ALWAYS_VISIBLE: true,
        hideLobbyButton: !isHost, // Hide Lobby control from students
      }
    };

    apiRef.current = new window.JitsiMeetExternalAPI(DOMAIN, options);

    apiRef.current.addEventListeners({
      videoConferenceJoined: () => {
        setIsLoading(false);
        logAttendance();
        
        // 🔒 TEACHER AUTO-ENABLES LOBBY (Optional Security)
        // If you want to force approval for every student:
        // if (isHost) apiRef.current.executeCommand('toggleLobby', true);
      },
      videoConferenceLeft: () => handleClose(),
    });
  };

  // --- 4. STREAMING LOGIC ---
  const handleGoLive = async () => {
    if (!isHost) return;
    const details = await startStream(batch, subject);
    
    if (details && apiRef.current) {
        try {
            apiRef.current.executeCommand('startRecording', {
                mode: 'stream',
                rtmpStreamKey: details.streamKey,
                youtubeStreamKey: details.streamKey,
                rtmpBroadcastID: details.broadcastId
            });
            toast.success("Connecting to YouTube... Please wait.");
        } catch (e) {
            toast.error("Failed to start stream command.");
        }
    }
  };

  // --- 5. ATTENDANCE LOGIC ---
  const logAttendance = async () => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        await supabase.from('class_attendance').insert({
            user_id: user.id,
            user_name: displayName,
            user_role: userRole,
            batch: batch,
            subject: subject,
            joined_at: new Date().toISOString(),
            status: 'present'
        });
    } catch (e) { console.error("Attendance Error", e); }
  };

  const handleClose = () => {
    if (apiRef.current) apiRef.current.dispose();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* HEADER */}
      <div className="bg-gray-900 border-b border-gray-800 p-3 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4">
            <div>
              <h2 className="text-white font-bold">{subject}</h2>
              <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">{batch}</span>
            </div>
            
            {/* GO LIVE BUTTON (Teacher Only) */}
            {isHost && (
                <Button 
                    size="sm"
                    onClick={handleGoLive} 
                    disabled={isStreaming || isStartingStream}
                    className={`${isStreaming ? 'bg-red-600 animate-pulse' : 'bg-blue-600'} text-white border-none`}
                >
                    {isStartingStream ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Youtube className="w-4 h-4 mr-2" />}
                    {isStreaming ? "LIVE ON YOUTUBE" : "GO LIVE"}
                </Button>
            )}
        </div>
        
        <Button variant="ghost" size="icon" onClick={handleClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
        </Button>
      </div>

      {/* MEETING CONTAINER */}
      <div className="flex-1 relative bg-gray-900">
         {isLoading && (
             <div className="absolute inset-0 flex items-center justify-center text-white">
                 <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                 <span className="ml-3 text-lg">Connecting to Secure Classroom...</span>
             </div>
         )}
         <div ref={jitsiContainerRef} className="w-full h-full" />
      </div>
    </div>
  );
};
