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

// Increased timeout to 60s to allow time for connection/authentication
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
    toast.info('Meeting opened in new tab');
  }, [getSanitizedRoomName]);

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
    if (isInitializingRef.current || apiRef.current) return;
    isInitializingRef.current = true;
    
    if (!jitsiContainerRef.current) {
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
        setLoadingMessage('Starting classroom environment...');
    } else {
        setLoadingMessage('Connecting to class...');
    }
    
    // Show fallback prompt faster if it takes too long
    fallbackTimeoutRef.current = setTimeout(() => {
      if (isLoadingRef.current) {
        setShowFallbackPrompt(true);
        if (!isHost) {
             setLoadingMessage('Waiting for teacher to start class...');
        } else {
             setLoadingMessage('Waiting for authentication...');
        }
      }
    }, 8000);
    
    connectionTimeoutRef.current = setTimeout(() => {
      if (isLoadingRef.current) {
        // Just update message, let them wait in lobby
        setLoadingMessage('Still connecting to room...');
      }
    }, CONNECTION_TIMEOUT_MS);

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
        TOOLBAR_BUTTONS: [
          'microphone', 'camera', 'desktop', 'chat',
          'raisehand', 'participants-pane', 'tileview', 'fullscreen',
          'videoquality', 'filmstrip', 'settings', 'hangup', 'overflowmenu', 'sharedvideo'
        ],
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        DEFAULT_REMOTE_DISPLAY_NAME: 'Participant',
        MOBILE_APP_PROMO: false,
        HIDE_INVITE_MORE_HEADER: true,
      }
    };

    try {
      apiRef.current = new window.JitsiMeetExternalAPI(domain, options);
      
      // Force UI reveal immediately to show login prompts/lobby screens
      setTimeout(() => {
          setLoadingState(false);
          isInitializingRef.current = false;
      }, 1500);

      apiRef.current.addEventListeners({
        videoConferenceJoined: () => {
          if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
          if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
          if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
          setLoadingState(false);
          setConnectionError(false);
          isInitializingRef.current = false;
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
        initializeJitsi();
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

  // Special Start Handler for Hosts - NOW UNIFIED
  const handleHostStart = () => {
    // Direct start without new tab redirection
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
    // FIX: Flexbox Column Layout ensures Header never overlaps the iframe
    <div className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden">
      
      {/* Header - Stays at top */}
      <div className="relative z-20 bg-gray-900/95 backdrop-blur border-b border-white/10 p-3 flex justify-between items-center shrink-0 shadow-sm">
        <div>
          <h2 className="text-white font-semibold text-lg leading-tight">{subject}</h2>
          <p className="text-gray-400 text-xs">{batch}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={handleClose} className="text-white hover:bg-white/20 h-8 w-8">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Content Area - Fills remaining space */}
      <div className="flex-1 relative w-full bg-black">
        
        {/* START SCREEN */}
        {!hasJoined && !isLoading && !connectionError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-30">
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
                    <Video className="mr-2 h-5 w-5" />
                    Start Class Now
                  </Button>
                  <p className="text-xs text-gray-400 p-3 rounded-lg text-left">
                    Click to launch the classroom environment.
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
                  <p className="text-white text-lg font-semibold">
                      {isHost ? "Connection Taking Time..." : "Waiting for Teacher..."}
                  </p>
                  <p className="text-gray-400 text-sm mt-2 mb-6">
                      {isHost 
                          ? "The classroom is taking a while to load." 
                          : "The class hasn't started yet. Please wait for the teacher."}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button onClick={openInNewTab} className="bg-blue-600 hover:bg-blue-700">
                       <ExternalLink className="mr-2 h-4 w-4" /> 
                       Open in New Tab (Backup)
                    </Button>
                    <Button variant="outline" onClick={handleRetry} className="border-gray-500 text-gray-300">
                       <RefreshCw className="mr-2 h-4 w-4" /> 
                       Retry Here
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {connectionError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-30">
            <div className="text-center max-w-md px-4">
              <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <X className="h-6 w-6 text-red-400" />
              </div>
              <p className="text-white text-lg font-semibold">Connection Failed</p>
              <p className="text-gray-400 text-sm mt-2">
                  {isHost ? "Could not connect to the room." : "Unable to connect to class."}
              </p>
              <div className="flex gap-3 justify-center mt-6">
                <Button onClick={handleRetry} className="bg-blue-600 hover:bg-blue-700">Retry</Button>
                <Button variant="ghost" onClick={handleClose} className="text-white">Close</Button>
              </div>
            </div>
          </div>
        )}

        {/* CONTROLS (Floating) */}
        {!connectionError && hasJoined && !isLoading && (
          <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none z-40">
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

        {/* Jitsi Iframe - ABSOLUTE FILL to solve whitespace */}
        <div 
            ref={jitsiContainerRef} 
            className="absolute inset-0 w-full h-full bg-black"
            style={{ display: hasJoined ? 'block' : 'none' }}
        />
      </div>
    </div>
  );
};
