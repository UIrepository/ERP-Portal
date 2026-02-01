import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, X, RefreshCw, ExternalLink, AlertTriangle, Play, Lock, Youtube, Loader2, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { generateJitsiRoomName } from '@/lib/jitsiUtils';
import { useYoutubeStream } from '@/hooks/useYoutubeStream';

interface JitsiMeetingProps {
  roomName: string;
  displayName: string;
  subject: string;
  batch: string;
  scheduleId: string | null;
  onClose: () => void;
  userRole?: 'teacher' | 'student' | 'admin' | 'manager';
  userEmail?: string;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

// Timeout constants
const CONNECTION_TIMEOUT_MS = 60000; 
const SCRIPT_POLL_INTERVAL_MS = 100;
const SCRIPT_MAX_POLL_ATTEMPTS = 50;

// --- Script Loading Helpers ---
const injectNewScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log('[Jitsi] Injecting player library...');
    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.async = true;
    
    const timeoutId = setTimeout(() => {
      reject(new Error('Player library load timed out'));
    }, 15000); 
    
    script.onload = () => {
      clearTimeout(timeoutId);
      console.log('[Jitsi] Player library loaded successfully');
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timeoutId);
      console.error('[Jitsi] Player library failed to load');
      reject(new Error('Failed to load Jitsi player script'));
    };
    document.head.appendChild(script);
  });
};

const loadJitsiScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) {
      resolve();
      return;
    }
    const existingScript = document.querySelector('script[src*="external_api.js"]') as HTMLScriptElement;
    if (existingScript) {
      let attempts = 0;
      const pollInterval = setInterval(() => {
        attempts++;
        if (window.JitsiMeetExternalAPI) {
          clearInterval(pollInterval);
          resolve();
        } else if (attempts >= SCRIPT_MAX_POLL_ATTEMPTS) {
          clearInterval(pollInterval);
          try { existingScript.remove(); } catch (e) { console.warn('[Jitsi] Removing stuck script:', e); }
          injectNewScript().then(resolve).catch(reject);
        }
      }, SCRIPT_POLL_INTERVAL_MS);
      return;
    }
    injectNewScript().then(resolve).catch(reject);
  });
};

const waitForJitsiAPI = (): Promise<boolean> => {
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 30; 
    const checkAPI = () => {
      attempts++;
      if (window.JitsiMeetExternalAPI) {
        resolve(true);
      } else if (attempts >= maxAttempts) {
        resolve(false);
      } else {
        setTimeout(checkAPI, 500);
      }
    };
    checkAPI();
  });
};

export const JitsiMeeting = ({
  roomName,
  displayName,
  subject,
  batch,
  scheduleId,
  onClose,
  userRole = 'student',
  userEmail
}: JitsiMeetingProps) => {
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  
  // UI State
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false); 
  const [hasJoined, setHasJoined] = useState(false); 
  const [connectionError, setConnectionError] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Initializing Player...');
  const [showFallbackPrompt, setShowFallbackPrompt] = useState(false);
  const [lastStreamKey, setLastStreamKey] = useState<string | null>(null);

  const { startStream, isStreaming, isStartingStream } = useYoutubeStream();

  // Auth & Logic Refs
  const { profile, resolvedRole } = useAuth();
  const joinTimeRef = useRef<Date | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializingRef = useRef(false);
  const isLoadingRef = useRef(false); 
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRecordedAttendanceRef = useRef(false);
  const isIntentionalHangupRef = useRef(false);

  const propsRef = useRef({ displayName, userEmail, subject, batch, scheduleId, onClose, resolvedRole, profile, userRole });
  const isHost = userRole === 'teacher' || userRole === 'admin' || userRole === 'manager';

  useEffect(() => {
    propsRef.current = { displayName, userEmail, subject, batch, scheduleId, onClose, resolvedRole, profile, userRole };
    if (apiRef.current && displayName) {
        try { apiRef.current.executeCommand('displayName', displayName); } catch (e) { console.warn('[Jitsi] Failed to update display name', e); }
    }
  }, [displayName, userEmail, subject, batch, scheduleId, onClose, resolvedRole, profile, userRole]);

  // REMOVED: URL Masking/Rewriting block to ensure UUID stays in URL
  // const originalUrl = window.location.href ...

  const setLoadingState = useCallback((loading: boolean) => {
    isLoadingRef.current = loading;
    setIsLoading(loading);
    if (!loading) setShowFallbackPrompt(false);
  }, []);

  const getSanitizedRoomName = useCallback(() => {
    // This room name is SHARED among all users so they land in the same meeting
    // irrespective of their unique URL.
    return generateJitsiRoomName(batch, subject);
  }, [batch, subject]);

  const openInNewTab = useCallback(() => {
    // This fallback will still open the generic shared room if clicked
    // but the primary secure entry is via the parent page
    const sanitizedRoomName = getSanitizedRoomName();
    window.open(`https://meet.jit.si/${sanitizedRoomName}`, '_blank');
    toast.info('Meeting opened in new tab');
  }, [getSanitizedRoomName]);

  const recordAttendance = useCallback(async () => {
    const currentProps = propsRef.current;
    if (hasRecordedAttendanceRef.current) return;
    if (!currentProps.profile?.user_id) return;
    const safeScheduleId = currentProps.scheduleId && currentProps.scheduleId.trim() !== '' ? currentProps.scheduleId : null;
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const payload = {
        user_id: currentProps.profile.user_id,
        user_name: currentProps.displayName || currentProps.profile.name,
        user_role: currentProps.resolvedRole,
        schedule_id: safeScheduleId,
        batch: currentProps.batch,
        subject: currentProps.subject,
        class_date: today,
        joined_at: new Date().toISOString()
      };
      const { error } = await supabase.from('class_attendance').upsert(payload, { onConflict: 'user_id,schedule_id,class_date' });
      if (error) {
         if (error.code === '42501') toast.error('Attendance Failed: Permission Denied. Please contact admin.');
      } else {
          joinTimeRef.current = new Date();
          hasRecordedAttendanceRef.current = true;
      }
    } catch (error) { console.error('[Attendance] Unexpected error:', error); }
  }, []);

  const updateAttendanceOnLeave = useCallback(async () => {
    const currentProps = propsRef.current;
    if (!currentProps.profile?.user_id || !joinTimeRef.current) return;
    const safeScheduleId = currentProps.scheduleId && currentProps.scheduleId.trim() !== '' ? currentProps.scheduleId : null;
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const durationMs = new Date().getTime() - joinTimeRef.current.getTime();
      const durationMinutes = Math.round(durationMs / 60000);
      let query = supabase.from('class_attendance').update({ left_at: new Date().toISOString(), duration_minutes: durationMinutes }).eq('user_id', currentProps.profile.user_id).eq('class_date', today);
      if (safeScheduleId) query = query.eq('schedule_id', safeScheduleId);
      else query = query.eq('batch', currentProps.batch).eq('subject', currentProps.subject);
      await query;
    } catch (error) { console.error('[Attendance] Error updating on leave:', error); }
  }, []);

  const handleGoLive = async () => {
    const currentProps = propsRef.current;
    if (!isHost) {
        toast.error("Only teachers can start the live stream.");
        return;
    }
    const streamDetails = await startStream(currentProps.batch, currentProps.subject);
    if (streamDetails && apiRef.current) {
         setLastStreamKey(streamDetails.streamKey);
         try {
            console.log("Starting Jitsi stream with key:", streamDetails.streamKey);
            apiRef.current.executeCommand('startRecording', {
                mode: 'stream',
                rtmpStreamKey: streamDetails.streamKey,
                youtubeStreamKey: streamDetails.streamKey, 
                rtmpBroadcastID: streamDetails.broadcastId
            });
            toast.success("Command sent. Waiting for YouTube...");
            setTimeout(() => {
                toast.info("If streaming didn't start automatically:", {
                    description: "Click the '...' button in the bottom bar -> 'Start Live Stream', and paste the key.",
                    duration: 10000,
                    action: {
                        label: "Copy Key",
                        onClick: () => {
                             navigator.clipboard.writeText(streamDetails.streamKey);
                             toast.success("Key copied!");
                        }
                    }
                });
            }, 6000);
        } catch (e) {
            console.error("Jitsi Command Error:", e);
            toast.error("Failed to send command to Jitsi player.");
        }
    }
  };

  const initializeJitsi = useCallback(async () => {
    if (isInitializingRef.current || apiRef.current) return;
    isInitializingRef.current = true;
    
    if (!jitsiContainerRef.current) {
      setConnectionError(true);
      setLoadingState(false);
      isInitializingRef.current = false;
      return;
    }

    setLoadingState(true);
    setLoadingMessage(isHost ? 'Starting classroom player...' : 'Connecting to live stream...');
    
    try { await loadJitsiScript(); } catch (error) { toast.error('Failed to load video player.'); setConnectionError(true); setLoadingState(false); isInitializingRef.current = false; return; }
    const apiAvailable = await waitForJitsiAPI();
    if (!apiAvailable) { toast.error('Player system failed to initialize.'); setConnectionError(true); setLoadingState(false); isInitializingRef.current = false; return; }

    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);

    fallbackTimeoutRef.current = setTimeout(() => {
      if (isLoadingRef.current) {
        setShowFallbackPrompt(true);
        setLoadingMessage(isHost ? 'Waiting for authentication...' : 'Waiting for teacher to start stream...');
      }
    }, 8000);
    
    connectionTimeoutRef.current = setTimeout(() => {
      if (isLoadingRef.current) setLoadingMessage('Still connecting to room...');
    }, CONNECTION_TIMEOUT_MS);

    const domain = 'meet.jit.si';
    const sanitizedRoomName = getSanitizedRoomName();
    const currentProps = propsRef.current;
    
    const TEACHER_TOOLBAR = [
        'microphone', 'camera', 'desktop', 'chat', 'raisehand', 
        'participants-pane', 'tileview', 'fullscreen', 'videoquality', 
        'filmstrip', 'settings', 'hangup', 'overflowmenu', 'sharedvideo',
        'livestreaming', 'recording', 'mute-everyone', 'security', 'stats'
    ];

    const STUDENT_TOOLBAR = [
        'microphone', 'camera', 'desktop', 'chat', 'raisehand', 
        'participants-pane', 'tileview', 'fullscreen', 'videoquality', 
        'filmstrip', 'settings', 'hangup', 'overflowmenu'
    ];

    const options = {
      roomName: sanitizedRoomName,
      width: '100%',
      height: '100%',
      parentNode: jitsiContainerRef.current,
      userInfo: { displayName: currentProps.displayName, email: currentProps.userEmail || undefined },
      configOverwrite: {
        prejoinPageEnabled: false,
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        disableDeepLinking: true,
        disableInviteFunctions: true,
        liveStreamingEnabled: true,
        
        // --- BYPASS 5-MIN TIMER CONFIGURATION ---
        p2p: { 
            enabled: false, // Force JVB connection
            useStunTurn: true 
        },
        disable1On1Mode: true, // Always use the bridge
        
        enableLayerSuspension: true,
        disableSuspendVideo: true,
        
        enableNoisyMicDetection: false,
        enableNoAudioDetection: false,
        
        lobby: { autoKnock: true, enableChat: true },
        hideLobbyButton: true,
        enableInsecureRoomNameWarning: false,
        requireDisplayName: false,
        enableWelcomePage: false,
        enableClosePage: false, 
        notifications: [],
        startAudioOnly: false,
      },
      interfaceConfigOverwrite: {
        TOOLBAR_BUTTONS: isHost ? TEACHER_TOOLBAR : STUDENT_TOOLBAR,
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        DEFAULT_REMOTE_DISPLAY_NAME: 'Participant',
        MOBILE_APP_PROMO: false,
        HIDE_INVITE_MORE_HEADER: true,
        SHARING_FEATURES: [], 
      }
    };

    try {
      apiRef.current = new window.JitsiMeetExternalAPI(domain, options);
      
      setTimeout(() => { setLoadingState(false); isInitializingRef.current = false; }, 1500);
      setTimeout(() => { if (!hasRecordedAttendanceRef.current) recordAttendance(); }, 3000);

      apiRef.current.addEventListeners({
        videoConferenceJoined: () => {
          if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
          if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
          setLoadingState(false);
          setConnectionError(false);
          isInitializingRef.current = false;
          recordAttendance();
        },
        videoConferenceLeft: () => {
            updateAttendanceOnLeave();
            if (!isIntentionalHangupRef.current) {
                toast.warning("Connection dropped. Please refresh if not reconnected.");
            }
        },
        recordingStatusChanged: (payload: any) => {
             console.log("Jitsi Recording Status Changed:", payload);
             if (payload.on) {
                 toast.success("Stream is now LIVE on YouTube!");
             } else if (payload.error) {
                 toast.error(`Stream Error: ${payload.error}`);
             }
        },
        readyToClose: () => { 
            updateAttendanceOnLeave(); 
            if (propsRef.current.onClose) propsRef.current.onClose(); 
        },
        audioMuteStatusChanged: ({ muted }: { muted: boolean }) => setIsAudioMuted(muted),
        videoMuteStatusChanged: ({ muted }: { muted: boolean }) => setIsVideoMuted(muted),
      });

      if (currentProps.subject) {
        setTimeout(() => { if(apiRef.current) apiRef.current.executeCommand('subject', `${currentProps.subject} - ${currentProps.batch}`); }, 1000);
      }
    } catch (error) {
      console.error('[Jitsi] Error creating meeting:', error);
      setConnectionError(true);
      setLoadingState(false);
      isInitializingRef.current = false;
    }
  }, [getSanitizedRoomName, recordAttendance, updateAttendanceOnLeave, setLoadingState, isHost]);

  useEffect(() => {
    if (!hasJoined) return;
    if (!isInitializingRef.current && !apiRef.current) initializeJitsi();
    return () => {
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
      if (apiRef.current) { updateAttendanceOnLeave(); try { apiRef.current.dispose(); } catch (e) {} apiRef.current = null; }
      isInitializingRef.current = false;
    };
  }, [hasJoined, initializeJitsi, updateAttendanceOnLeave]);

  const handleStartClass = () => {
    isIntentionalHangupRef.current = false;
    setHasJoined(true);
  };
  
  const handleRetry = useCallback(async () => {
    if (apiRef.current) { try { apiRef.current.dispose(); } catch (e) {} apiRef.current = null; }
    isInitializingRef.current = false;
    setLoadingState(true);
    setConnectionError(false);
    setLoadingMessage('Reloading Player...');
    setShowFallbackPrompt(false);
    await new Promise(resolve => setTimeout(resolve, 500));
    initializeJitsi();
  }, [initializeJitsi, setLoadingState]);

  const handleClose = useCallback(() => {
    isIntentionalHangupRef.current = true;
    updateAttendanceOnLeave();
    if (apiRef.current) try { apiRef.current.dispose(); } catch (e) {}
    if (propsRef.current.onClose) propsRef.current.onClose();
  }, [updateAttendanceOnLeave]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <div className="relative z-20 bg-gray-900/95 backdrop-blur border-b border-white/10 p-3 flex justify-between items-center shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
            <div>
              <h2 className="text-white font-semibold text-lg leading-tight">{subject}</h2>
              <p className="text-gray-400 text-xs">{batch}</p>
            </div>
            
            {hasJoined && !isLoading && isHost && (
                <Button 
                    variant={isStreaming ? "default" : "outline"} 
                    size="sm"
                    onClick={handleGoLive} 
                    disabled={isStartingStream || isStreaming}
                    className={`h-8 ${isStreaming ? 'bg-red-600 hover:bg-red-700 border-red-500 text-white' : 'border-red-500/50 text-red-500 hover:bg-red-500/10'}`}
                >
                    {isStartingStream ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                        <Youtube className="h-4 w-4 mr-2" />
                    )}
                    {isStreaming ? "Live" : "Go Live"}
                </Button>
            )}
        </div>

        <div className="flex items-center gap-2">
           {lastStreamKey && isHost && (
               <Button variant="outline" size="sm" onClick={() => {navigator.clipboard.writeText(lastStreamKey); toast.success("Stream Key Copied");}} className="h-8 text-xs border-white/20 text-gray-300">
                   <Copy className="h-3 w-3 mr-2" /> Key
               </Button>
           )}
           <Button variant="ghost" size="icon" onClick={handleClose} className="text-white hover:bg-white/20 h-8 w-8">
             <X className="h-5 w-5" />
           </Button>
        </div>
      </div>

      <div className="flex-1 relative w-full bg-black">
        {!hasJoined && !isLoading && !connectionError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-30">
            <div className="text-center max-w-md px-4 animate-in fade-in zoom-in duration-300">
              <div className="h-20 w-20 rounded-full bg-blue-600/20 flex items-center justify-center mx-auto mb-6">
                {isHost ? <Lock className="h-10 w-10 text-blue-500" /> : <Video className="h-10 w-10 text-blue-500" />}
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                {isHost ? 'Start Live Class' : 'Ready to Watch?'}
              </h3>
              <p className="text-gray-400 mb-8">Class: {subject} <br/> Batch: {batch}</p>
              <Button size="lg" onClick={handleStartClass} className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6 h-auto rounded-full shadow-lg transition-transform hover:scale-105">
                {isHost ? <><Video className="mr-2 h-5 w-5" /> Start Broadcast</> : <><Play className="mr-2 h-5 w-5 fill-current" /> Join Stream</>}
              </Button>
            </div>
          </div>
        )}

        {isLoading && !connectionError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-30 pointer-events-none">
            <div className="text-center max-w-md px-4 pointer-events-auto">
              {!showFallbackPrompt ? (
                <>
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-white">{loadingMessage}</p>
                </>
              ) : (
                <>
                  <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="h-6 w-6 text-yellow-400" />
                  </div>
                  <p className="text-white text-lg font-semibold">{isHost ? "Taking longer than usual..." : "Waiting for Broadcast..."}</p>
                  <p className="text-gray-400 text-sm mt-2 mb-6">{isHost ? "The player is initializing." : "The teacher hasn't started the stream yet, or connection is slow."}</p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button onClick={openInNewTab} className="bg-blue-600 hover:bg-blue-700"><ExternalLink className="mr-2 h-4 w-4" /> Open in New Tab (Backup)</Button>
                    <Button variant="outline" onClick={handleRetry} className="border-gray-500 text-gray-300"><RefreshCw className="mr-2 h-4 w-4" /> Retry Player</Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {connectionError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-30">
            <div className="text-center max-w-md px-4">
              <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4"><X className="h-6 w-6 text-red-400" /></div>
              <p className="text-white text-lg font-semibold">Player Error</p>
              <p className="text-gray-400 text-sm mt-2">Unable to connect to the live stream.</p>
              <div className="flex gap-3 justify-center mt-6">
                <Button onClick={handleRetry} className="bg-blue-600 hover:bg-blue-700">Retry</Button>
                <Button variant="ghost" onClick={handleClose} className="text-white">Close</Button>
              </div>
            </div>
          </div>
        )}

        <div ref={jitsiContainerRef} className="absolute inset-0 w-full h-full bg-black" style={{ display: hasJoined ? 'block' : 'none' }} />
      </div>
    </div>
  );
};
