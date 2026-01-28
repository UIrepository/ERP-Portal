import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, X, RefreshCw, ExternalLink, AlertTriangle, Play, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { generateJitsiRoomName } from '@/lib/jitsiUtils';

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

// Increased timeout to 60s to allow Teachers enough time to login in the new tab
const CONNECTION_TIMEOUT_MS = 60000; 
const SCRIPT_POLL_INTERVAL_MS = 100;
const SCRIPT_MAX_POLL_ATTEMPTS = 50;

// --- Script Loading Helpers ---
const injectNewScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log('[Jitsi] Injecting new script...');
    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.async = true;
    
    const timeoutId = setTimeout(() => {
      reject(new Error('Script load timed out'));
    }, 15000); 
    
    script.onload = () => {
      clearTimeout(timeoutId);
      console.log('[Jitsi] Script loaded successfully');
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timeoutId);
      console.error('[Jitsi] Script failed to load');
      reject(new Error('Failed to load Jitsi script'));
    };
    document.head.appendChild(script);
  });
};

const loadJitsiScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // If API is already available, resolve immediately
    if (window.JitsiMeetExternalAPI) {
      resolve();
      return;
    }
    
    // Check for existing script tag
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
          // Remove old script and inject fresh one
          try {
            existingScript.remove();
          } catch (e) {
            console.warn('[Jitsi] Could not remove old script:', e);
          }
          
          injectNewScript().then(resolve).catch(reject);
        }
      }, SCRIPT_POLL_INTERVAL_MS);
      
      return;
    }
    
    // No existing script, inject new one
    injectNewScript().then(resolve).catch(reject);
  });
};

const waitForJitsiAPI = (): Promise<boolean> => {
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 30; // 15 seconds max
    
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
  const [isLoading, setIsLoading] = useState(false); // Default false, waits for user to click
  const [hasJoined, setHasJoined] = useState(false); // New state: "Has user clicked Join?"
  const [connectionError, setConnectionError] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [showFallbackPrompt, setShowFallbackPrompt] = useState(false);

  // Auth & Refs
  const { profile, resolvedRole } = useAuth();
  const joinTimeRef = useRef<Date | null>(null);
  
  // Initialization Refs
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializingRef = useRef(false);
  const isLoadingRef = useRef(false); 
  const progressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Store latest props
  const propsRef = useRef({ displayName, userEmail, subject, batch, scheduleId, onClose, resolvedRole, profile, userRole });

  // Determine if current user is a "Host" (Teacher/Admin) who must create the room
  const isHost = userRole === 'teacher' || userRole === 'admin' || userRole === 'manager';

  // Update refs when props change
  useEffect(() => {
    propsRef.current = { displayName, userEmail, subject, batch, scheduleId, onClose, resolvedRole, profile, userRole };
    
    if (apiRef.current && displayName) {
        try {
          apiRef.current.executeCommand('displayName', displayName);
        } catch (e) {
          console.warn('[Jitsi] Failed to update display name', e);
        }
    }
  }, [displayName, userEmail, subject, batch, scheduleId, onClose, resolvedRole, profile, userRole]);

  // URL Management - Update browser URL to reflect meeting state
  useEffect(() => {
    const originalUrl = window.location.href;
    const meetingPath = `/class/${batch.replace(/\s+/g, '-').toLowerCase()}/${subject.replace(/\s+/g, '-').toLowerCase()}`;
    
    window.history.pushState({ path: meetingPath }, '', meetingPath);

    return () => {
      window.history.pushState({ path: originalUrl }, '', originalUrl);
    };
  }, [batch, subject]);

  const setLoadingState = useCallback((loading: boolean) => {
    isLoadingRef.current = loading;
    setIsLoading(loading);
    if (!loading) {
      setShowFallbackPrompt(false);
    }
  }, []);

  const getSanitizedRoomName = useCallback(() => {
    return generateJitsiRoomName(batch, subject);
  }, [batch, subject]);

  const openInNewTab = useCallback(() => {
    const sanitizedRoomName = getSanitizedRoomName();
    window.open(`https://meet.jit.si/${sanitizedRoomName}`, '_blank');
    if (isHost) {
      toast.info('Please log in and start the meeting in the new tab.');
    } else {
      toast.info('Meeting opened in new tab');
    }
  }, [getSanitizedRoomName, isHost]);

  // Attendance Logic
  const recordAttendance = useCallback(async () => {
    const currentProps = propsRef.current;
    if (!currentProps.profile?.user_id) return;
    
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      await supabase.from('class_attendance').upsert({
        user_id: currentProps.profile.user_id,
        user_name: currentProps.displayName || currentProps.profile.name,
        user_role: currentProps.resolvedRole,
        schedule_id: currentProps.scheduleId,
        batch: currentProps.batch,
        subject: currentProps.subject,
        class_date: today,
        joined_at: new Date().toISOString()
      }, { 
        onConflict: 'user_id,schedule_id,class_date'
      });
      
      joinTimeRef.current = new Date();
      toast.success('You have joined the class');
    } catch (error) {
      console.error('[Jitsi] Error recording attendance:', error);
    }
  }, []);

  const updateAttendanceOnLeave = useCallback(async () => {
    const currentProps = propsRef.current;
    if (!currentProps.profile?.user_id || !joinTimeRef.current) return;
    
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const durationMs = new Date().getTime() - joinTimeRef.current.getTime();
      const durationMinutes = Math.round(durationMs / 60000);
      
      await supabase.from('class_attendance')
        .update({ 
          left_at: new Date().toISOString(),
          duration_minutes: durationMinutes
        })
        .eq('user_id', currentProps.profile.user_id)
        .eq('class_date', today)
        .eq('batch', currentProps.batch)
        .eq('subject', currentProps.subject);
    } catch (error) {
      console.error('[Jitsi] Error updating attendance on leave:', error);
    }
  }, []);

  // Jitsi Initialization
  const initializeJitsi = useCallback(async () => {
    // Prevent double initialization
    if (isInitializingRef.current || apiRef.current) return;
    
    isInitializingRef.current = true;
    
    if (!jitsiContainerRef.current) {
      console.error("Container ref is null");
      setConnectionError(true);
      setLoadingState(false);
      isInitializingRef.current = false;
      return;
    }

    setLoadingState(true);
    setLoadingMessage('Loading video system...');
    
    try {
      await loadJitsiScript();
    } catch (error) {
      toast.error('Failed to load video system.');
      setConnectionError(true);
      setLoadingState(false);
      isInitializingRef.current = false;
      return;
    }

    const apiAvailable = await waitForJitsiAPI();
    if (!apiAvailable) {
      toast.error('Video system failed to initialize.');
      setConnectionError(true);
      setLoadingState(false);
      isInitializingRef.current = false;
      return;
    }

    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
    if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);

    // Initial message based on role
    if (isHost) {
        setLoadingMessage('Waiting for you to start meeting in new tab...');
    } else {
        setLoadingMessage('Connecting to class...');
    }
    
    const domain = 'meet.jit.si';
    const sanitizedRoomName = getSanitizedRoomName();
    const currentProps = propsRef.current;
    
    const options = {
      roomName: sanitizedRoomName,
      width: '100%',
      height: '100%',
      parentNode: jitsiContainerRef.current,
      userInfo: {
        displayName: currentProps.displayName,
        email: currentProps.userEmail || undefined,
      },
      configOverwrite: {
        prejoinPageEnabled: false,
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        disableDeepLinking: true,
        disableInviteFunctions: true,
        lobby: { autoKnock: true, enableChat: true }, // Enable chat in lobby if supported
        hideLobbyButton: true,
        enableInsecureRoomNameWarning: false,
        requireDisplayName: false,
        enableWelcomePage: false,
        enableClosePage: false,
        notifications: [],
        startAudioOnly: false,
      },
      interfaceConfigOverwrite: {
        // Full list of buttons to ensure Chat and others are visible
        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'desktop', 'chat', 'raisehand',
          'participants-pane', 'tileview', 'fullscreen', 
          'videoquality', 'filmstrip', 'settings', 
          'hangup', 'overflowmenu' // Important for small screens
        ],
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        DEFAULT_REMOTE_DISPLAY_NAME: 'Participant',
        MOBILE_APP_PROMO: false,
        HIDE_INVITE_MORE_HEADER: true,
      }
    };

    try {
      // Create the API instance
      apiRef.current = new window.JitsiMeetExternalAPI(domain, options);
      
      // CRITICAL FIX: Hide the spinner immediately so the user can see the Jitsi UI
      // This reveals the "Login" or "Waiting" screen immediately
      setTimeout(() => {
          setLoadingState(false);
          isInitializingRef.current = false;
      }, 1000);

      apiRef.current.addEventListeners({
        videoConferenceJoined: () => {
          if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
          if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
          if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
          setLoadingState(false);
          setConnectionError(false);
          recordAttendance();
        },
        videoConferenceLeft: () => updateAttendanceOnLeave(),
        readyToClose: () => {
          updateAttendanceOnLeave();
          if (propsRef.current.onClose) propsRef.current.onClose();
        },
        audioMuteStatusChanged: ({ muted }: { muted: boolean }) => setIsAudioMuted(muted),
        videoMuteStatusChanged: ({ muted }: { muted: boolean }) => setIsVideoMuted(muted),
      });

      if (currentProps.subject) {
        setTimeout(() => {
            if(apiRef.current) apiRef.current.executeCommand('subject', `${currentProps.subject} - ${currentProps.batch}`);
        }, 1000);
      }
    } catch (error) {
      console.error('[Jitsi] Error creating meeting:', error);
      setConnectionError(true);
      setLoadingState(false);
      isInitializingRef.current = false;
    }
  }, [getSanitizedRoomName, recordAttendance, updateAttendanceOnLeave, setLoadingState, isHost]);

  // Main Effect to trigger start
  useEffect(() => {
    if (!hasJoined) return;
    
    if (!isInitializingRef.current && !apiRef.current) {
        // Slight delay to ensure DOM render
        const t = setTimeout(() => {
            initializeJitsi();
        }, 100);
        return () => clearTimeout(t);
    }

    return () => {
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
      if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
      if (apiRef.current) {
        updateAttendanceOnLeave();
        try { apiRef.current.dispose(); } catch (e) {}
        apiRef.current = null;
      }
      isInitializingRef.current = false;
    };
  }, [hasJoined, initializeJitsi, updateAttendanceOnLeave]);

  // Special Start Handler for Hosts
  const handleHostStart = () => {
    // 1. Open new tab to allow host to create room/authenticate
    openInNewTab();
    // 2. Start local iframe which will retry until room exists
    setHasJoined(true);
  };

  const handleStartClass = () => {
    setHasJoined(true);
  };

  const handleRetry = useCallback(async () => {
    if (apiRef.current) { try { apiRef.current.dispose(); } catch (e) {} apiRef.current = null; }
    isInitializingRef.current = false;
    setLoadingState(true);
    setConnectionError(false);
    setLoadingMessage('Reloading...');
    setShowFallbackPrompt(false);
    await new Promise(resolve => setTimeout(resolve, 500));
    initializeJitsi();
  }, [initializeJitsi, setLoadingState]);

  const toggleAudio = () => apiRef.current?.executeCommand('toggleAudio');
  const toggleVideo = () => apiRef.current?.executeCommand('toggleVideo');
  const toggleShareScreen = () => apiRef.current?.executeCommand('toggleShareScreen');
  const hangUp = () => { updateAttendanceOnLeave(); apiRef.current?.executeCommand('hangup'); };
  const handleClose = useCallback(() => {
    updateAttendanceOnLeave();
    if (apiRef.current) try { apiRef.current.dispose(); } catch (e) {}
    if (propsRef.current.onClose) propsRef.current.onClose();
  }, [updateAttendanceOnLeave]);

  return (
    // LAYOUT FIX: Changed from absolute positioning to flexbox column
    // This ensures the header never covers the iframe content
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      
      {/* Header: Relative positioning ensures it pushes content down */}
      <div className="relative z-10 bg-gray-900/90 backdrop-blur p-4 flex justify-between items-center shrink-0 shadow-md">
        <div>
          <h2 className="text-white font-semibold">{subject}</h2>
          <p className="text-gray-300 text-sm">{batch}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleClose} className="text-white hover:bg-white/20">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Main Content Area: Takes remaining height */}
      <div className="flex-1 relative w-full min-h-0 bg-gray-950">
        
        {/* START SCREEN: Adaptive based on Role */}
        {!hasJoined && !isLoading && !connectionError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-20">
            <div className="text-center max-w-md px-4 animate-in fade-in zoom-in duration-300">
              <div className="h-20 w-20 rounded-full bg-blue-600/20 flex items-center justify-center mx-auto mb-6">
                {isHost ? <Lock className="h-10 w-10 text-blue-500" /> : <Video className="h-10 w-10 text-blue-500" />}
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                {isHost ? 'Start Class' : 'Ready to Join?'}
              </h3>
              <p className="text-gray-400 mb-8">
                Class: {subject} <br/> Batch: {batch}
              </p>

              {isHost ? (
                <div className="space-y-4">
                  <Button 
                    size="lg" 
                    onClick={handleHostStart}
                    className="bg-green-600 hover:bg-green-700 text-lg px-8 py-6 w-full rounded-full shadow-lg transition-transform hover:scale-105"
                  >
                    <ExternalLink className="mr-2 h-5 w-5" />
                    Launch & Authenticate
                  </Button>
                  <p className="text-xs text-yellow-500/80 bg-yellow-500/10 p-3 rounded-lg text-left">
                    <strong>Required:</strong> Jitsi requires you to login to create the room. 
                    Clicking this will open a new tab where you must login/start the meeting.
                    This window will connect automatically once you do.
                  </p>
                </div>
              ) : (
                <Button 
                  size="lg" 
                  onClick={handleStartClass}
                  className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6 h-auto rounded-full shadow-lg transition-transform hover:scale-105"
                >
                  <Play className="mr-2 h-5 w-5 fill-current" />
                  Join Class Now
                </Button>
              )}
            </div>
          </div>
        )}

        {/* LOADING STATE */}
        {isLoading && !connectionError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/90 z-20 pointer-events-none">
            <div className="text-center max-w-md px-4">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-white">{loadingMessage}</p>
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {connectionError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-20">
            <div className="text-center max-w-md px-4">
              <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <X className="h-6 w-6 text-red-400" />
              </div>
              <p className="text-white text-lg font-semibold">Connection Failed</p>
              <p className="text-gray-400 text-sm mt-2">
                  {isHost ? "Could not connect to the room. Did you create it in the new tab?" : "Unable to connect to class."}
              </p>
              <div className="flex gap-3 justify-center mt-6">
                <Button onClick={handleRetry} className="bg-blue-600 hover:bg-blue-700">Retry</Button>
                <Button variant="ghost" onClick={handleClose} className="text-white">Close</Button>
              </div>
            </div>
          </div>
        )}

        {/* Jitsi Iframe Container */}
        <div 
            ref={jitsiContainerRef} 
            className="w-full h-full" 
            style={{ display: hasJoined ? 'block' : 'none' }}
        />
      </div>

      {/* CONTROLS (Floating over the video at bottom) */}
      {!connectionError && hasJoined && !isLoading && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none z-30">
          <div className="bg-gray-900/80 backdrop-blur rounded-full p-2 flex gap-4 pointer-events-auto shadow-2xl border border-white/10">
            <Button variant={isAudioMuted ? "destructive" : "secondary"} size="icon" onClick={toggleAudio} className="rounded-full w-12 h-12">
              {isAudioMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            <Button variant={isVideoMuted ? "destructive" : "secondary"} size="icon" onClick={toggleVideo} className="rounded-full w-12 h-12">
              {isVideoMuted ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </Button>
            <Button variant="secondary" size="icon" onClick={toggleShareScreen} className="rounded-full w-12 h-12">
              <MonitorUp className="h-5 w-5" />
            </Button>
            <Button variant="destructive" size="icon" onClick={hangUp} className="rounded-full w-12 h-12">
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
