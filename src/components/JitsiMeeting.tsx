import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, X, RefreshCw, ExternalLink, AlertTriangle, Play } from 'lucide-react';
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

const CONNECTION_TIMEOUT_MS = 45000; // 45 seconds timeout
const SCRIPT_POLL_INTERVAL_MS = 100;
const SCRIPT_MAX_POLL_ATTEMPTS = 50; // 5 seconds max for script polling

// --- Script Loading Helpers ---

// Helper function to inject a fresh Jitsi script
const injectNewScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log('[Jitsi] Injecting new script...');
    const script = document.createElement('script');
    script.src = 'https://meet.jit.si/external_api.js';
    script.async = true;
    
    // Set a timeout for the script resource itself to load
    const timeoutId = setTimeout(() => {
      reject(new Error('Script load timed out'));
    }, 15000); // 15 seconds
    
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

// Robust script loading with polling fallback
// This ensures we don't try to initialize before window.JitsiMeetExternalAPI is defined
const loadJitsiScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log('[Jitsi] Checking script status...');
    
    // If API is already available, resolve immediately
    if (window.JitsiMeetExternalAPI) {
      console.log('[Jitsi] API already loaded');
      resolve();
      return;
    }
    
    // Check for existing script tag in the DOM
    const existingScript = document.querySelector('script[src*="external_api.js"]') as HTMLScriptElement;
    
    if (existingScript) {
      console.log('[Jitsi] Script tag exists, polling for API...');
      let attempts = 0;
      
      const pollInterval = setInterval(() => {
        attempts++;
        
        if (window.JitsiMeetExternalAPI) {
          clearInterval(pollInterval);
          console.log('[Jitsi] API became available after polling');
          resolve();
        } else if (attempts >= SCRIPT_MAX_POLL_ATTEMPTS) {
          clearInterval(pollInterval);
          console.log('[Jitsi] Existing script timed out, removing and injecting new script');
          
          // Remove old script and inject fresh one to force reload
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

// Wait for Jitsi API constructor to become available after script loads
const waitForJitsiAPI = (): Promise<boolean> => {
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 30; // 15 seconds max
    
    const checkAPI = () => {
      attempts++;
      console.log(`[Jitsi] Checking for API availability... attempt ${attempts}/${maxAttempts}`);
      
      if (window.JitsiMeetExternalAPI) {
        console.log('[Jitsi] API is available');
        resolve(true);
      } else if (attempts >= maxAttempts) {
        console.error('[Jitsi] API not available after maximum attempts');
        resolve(false);
      } else {
        setTimeout(checkAPI, 500);
      }
    };
    checkAPI();
  });
};

// --- Main Component ---

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
  const [isLoading, setIsLoading] = useState(false); // Default false, waits for user to click "Join"
  const [hasJoined, setHasJoined] = useState(false); // Track if user clicked the "Join Class" button
  const [connectionError, setConnectionError] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading video system...');
  const [showFallbackPrompt, setShowFallbackPrompt] = useState(false);

  // Data & Refs
  const { profile, resolvedRole } = useAuth();
  const joinTimeRef = useRef<Date | null>(null);
  
  // Initialization Refs (Prevent race conditions)
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializingRef = useRef(false);
  const isLoadingRef = useRef(false); 
  const progressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // FIX: Store latest props in a ref to avoid re-initialization on prop changes (e.g. Tab Switch)
  const propsRef = useRef({ displayName, userEmail, subject, batch, scheduleId, onClose, resolvedRole, profile });

  // Update refs when props change (Sync)
  useEffect(() => {
    propsRef.current = { displayName, userEmail, subject, batch, scheduleId, onClose, resolvedRole, profile };
    
    // Dynamically update display name if changed without re-joining
    if (apiRef.current && displayName) {
        try {
          apiRef.current.executeCommand('displayName', displayName);
        } catch (e) {
          console.warn('[Jitsi] Failed to update display name', e);
        }
    }
  }, [displayName, userEmail, subject, batch, scheduleId, onClose, resolvedRole, profile]);

  // FIX: URL Management - Update browser URL to reflect meeting state
  // This ensures that if the user refreshes or switches tabs, the context feels persistent
  useEffect(() => {
    const originalUrl = window.location.href;
    const meetingPath = `/class/${batch.replace(/\s+/g, '-').toLowerCase()}/${subject.replace(/\s+/g, '-').toLowerCase()}`;
    
    // Push state to browser history so URL looks correct (like a dedicated meeting page)
    window.history.pushState({ path: meetingPath }, '', meetingPath);

    return () => {
      // Restore original URL when meeting closes
      window.history.pushState({ path: originalUrl }, '', originalUrl);
    };
  }, [batch, subject]);

  // Helper to update loading state with ref sync
  const setLoadingState = useCallback((loading: boolean) => {
    isLoadingRef.current = loading;
    setIsLoading(loading);
    if (!loading) {
      setShowFallbackPrompt(false);
    }
  }, []);

  // Generate sanitized room name for Jitsi using shared utility
  const getSanitizedRoomName = useCallback(() => {
    return generateJitsiRoomName(batch, subject);
  }, [batch, subject]);

  // Open meeting in new tab as fallback
  const openInNewTab = useCallback(() => {
    const sanitizedRoomName = getSanitizedRoomName();
    window.open(`https://meet.jit.si/${sanitizedRoomName}`, '_blank');
    toast.info('Meeting opened in new tab');
  }, [getSanitizedRoomName]);

  // --- Attendance Logic ---

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
  }, []); // Empty dependencies, uses propsRef

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
  }, []); // Empty dependencies, uses propsRef

  // --- Jitsi Initialization Logic ---

  const initializeJitsi = useCallback(async () => {
    // Prevent double initialization
    if (isInitializingRef.current) {
      console.log('[Jitsi] Already initializing, skipping...');
      return;
    }
    isInitializingRef.current = true;

    console.log('[Jitsi] Starting initialization...');
    
    if (!jitsiContainerRef.current) {
      console.error('[Jitsi] Container not found');
      setConnectionError(true);
      setLoadingState(false);
      isInitializingRef.current = false;
      return;
    }

    // Step 1: Try to load script if needed
    setLoadingState(true);
    setLoadingMessage('Loading video system...');
    try {
      await loadJitsiScript();
      console.log('[Jitsi] Script loading completed');
    } catch (error) {
      console.error('[Jitsi] Failed to load script:', error);
      toast.error('Failed to load video system. Please try again.');
      setConnectionError(true);
      setLoadingState(false);
      isInitializingRef.current = false;
      return;
    }

    // Step 2: Wait for API to become available
    setLoadingMessage('Initializing video...');
    const apiAvailable = await waitForJitsiAPI();
    
    if (!apiAvailable) {
      console.error('[Jitsi] API not available after waiting');
      toast.error('Video system failed to initialize. Please try again.');
      setConnectionError(true);
      setLoadingState(false);
      isInitializingRef.current = false;
      return;
    }

    // Clear any existing timeouts to prevent interference
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
    if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);

    // Set progressive loading message
    setLoadingMessage('Connecting to class...');
    
    // Show fallback prompt after 10 seconds if still loading
    fallbackTimeoutRef.current = setTimeout(() => {
      if (isLoadingRef.current) {
        setShowFallbackPrompt(true);
        console.log('[Jitsi] Showing fallback prompt after 10s');
      }
    }, 10000);
    
    progressTimeoutRef.current = setTimeout(() => {
      if (isLoadingRef.current) {
        setLoadingMessage('Almost there...');
      }
    }, 15000);

    // Set connection timeout using ref to avoid stale closure
    connectionTimeoutRef.current = setTimeout(() => {
      if (isLoadingRef.current) {
        console.error('[Jitsi] Connection timeout after', CONNECTION_TIMEOUT_MS, 'ms');
        setLoadingState(false);
        setConnectionError(true);
        // We don't spam toast here, visual error state is enough
        isInitializingRef.current = false;
      }
    }, CONNECTION_TIMEOUT_MS);

    const domain = 'meet.jit.si';
    // FIX: Get fresh data from refs
    const sanitizedRoomName = getSanitizedRoomName();
    const currentProps = propsRef.current;
    
    console.log(`[Jitsi] Creating meeting room: ${sanitizedRoomName} for user: ${currentProps.displayName}`);
    
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
        // Skip pre-join screen entirely
        prejoinPageEnabled: false,
        prejoinConfig: {
          enabled: false
        },
        
        // Audio/Video settings
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        
        // Disable deep linking and invite functions
        disableDeepLinking: true,
        disableInviteFunctions: true,
        
        // CRITICAL: Disable lobby/waiting room - allows anyone to join without moderator
        lobby: {
          autoKnock: true,
          enableChat: false
        },
        hideLobbyButton: true,
        enableLobbyChat: false,
        
        // Security settings to allow open rooms without warnings
        enableInsecureRoomNameWarning: false,
        requireDisplayName: false,
        
        // Disable welcome/close pages
        enableWelcomePage: false,
        enableClosePage: false,
        
        // Additional settings to ensure smooth joining
        startAudioOnly: false,
        disableModeratorIndicator: false,
        
        // Disable notifications about lobby
        notifications: [],
        disabledNotifications: ['lobby.notificationTitle'],
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
        DISABLE_PRESENCE_STATUS: true,
        GENERATE_ROOMNAMES_ON_WELCOME_PAGE: false,
        SHOW_CHROME_EXTENSION_BANNER: false,
        HIDE_INVITE_MORE_HEADER: true,
      }
    };

    try {
      console.log('[Jitsi] Creating JitsiMeetExternalAPI instance...');
      apiRef.current = new window.JitsiMeetExternalAPI(domain, options);

      apiRef.current.addEventListeners({
        videoConferenceJoined: () => {
          console.log('[Jitsi] Successfully joined video conference');
          if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
          if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
          if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
          
          setLoadingState(false);
          setConnectionError(false);
          isInitializingRef.current = false;
          recordAttendance();
        },
        videoConferenceLeft: () => {
          console.log('[Jitsi] Left video conference');
          updateAttendanceOnLeave();
        },
        readyToClose: () => {
          console.log('[Jitsi] Ready to close');
          updateAttendanceOnLeave();
          // Call latest onClose from ref
          if (propsRef.current.onClose) {
              propsRef.current.onClose();
          }
        },
        audioMuteStatusChanged: ({ muted }: { muted: boolean }) => setIsAudioMuted(muted),
        videoMuteStatusChanged: ({ muted }: { muted: boolean }) => setIsVideoMuted(muted),
      });

      // Set subject as meeting title
      if (currentProps.subject) {
        setTimeout(() => {
          if(apiRef.current) {
            apiRef.current.executeCommand('subject', `${currentProps.subject} - ${currentProps.batch}`);
          }
        }, 1000);
      }
      
      console.log('[Jitsi] Meeting initialization complete, waiting for join...');
    } catch (error) {
      console.error('[Jitsi] Error creating meeting:', error);
      toast.error('Failed to start video meeting. Please try again.');
      setConnectionError(true);
      setLoadingState(false);
      isInitializingRef.current = false;
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
      if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
    }
  }, [getSanitizedRoomName, recordAttendance, updateAttendanceOnLeave, setLoadingState]); 

  // Handle user clicking the "Join" button
  const handleStartClass = () => {
    // FIX: Only set state. Let the useEffect trigger the logic.
    // This prevents double initialization race conditions.
    setHasJoined(true);
  };

  // Main Effect: Controls initialization based on hasJoined state
  useEffect(() => {
    if (!hasJoined) return; // Wait for user action

    // Only initialize if not already initializing and no API exists
    if (!isInitializingRef.current && !apiRef.current) {
        initializeJitsi();
    }

    return () => {
      console.log('[Jitsi] Cleaning up...');
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
      if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
      
      if (apiRef.current) {
        updateAttendanceOnLeave();
        try {
          apiRef.current.dispose();
        } catch (e) {
          console.warn('[Jitsi] Error during dispose:', e);
        }
        apiRef.current = null;
      }
      isInitializingRef.current = false;
    };
  }, [hasJoined, initializeJitsi, updateAttendanceOnLeave]);

  const handleRetry = useCallback(async () => {
    console.log('[Jitsi] Retrying connection...');
    
    // Dispose existing API if any
    if (apiRef.current) {
      try {
        apiRef.current.dispose();
      } catch (e) {
        console.error('[Jitsi] Error disposing API:', e);
      }
      apiRef.current = null;
    }
    
    // Clear timeouts
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
    if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
    
    // Remove existing script to force fresh load
    const existingScript = document.querySelector('script[src*="external_api.js"]');
    if (existingScript) {
      try {
        existingScript.remove();
        console.log('[Jitsi] Removed existing script for fresh reload');
      } catch (e) {
        console.warn('[Jitsi] Could not remove script:', e);
      }
    }
    
    isInitializingRef.current = false;
    setLoadingState(true);
    setConnectionError(false);
    setLoadingMessage('Reloading video system...');
    setShowFallbackPrompt(false);
    
    // Small delay to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
    
    initializeJitsi();
  }, [initializeJitsi, setLoadingState]);

  const toggleAudio = () => apiRef.current?.executeCommand('toggleAudio');
  const toggleVideo = () => apiRef.current?.executeCommand('toggleVideo');
  const toggleShareScreen = () => apiRef.current?.executeCommand('toggleShareScreen');
  const hangUp = () => {
    updateAttendanceOnLeave();
    apiRef.current?.executeCommand('hangup');
  };

  const handleClose = useCallback(() => {
    updateAttendanceOnLeave();
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    if (progressTimeoutRef.current) clearTimeout(progressTimeoutRef.current);
    
    if (apiRef.current) {
      try {
        apiRef.current.dispose();
      } catch (e) {
        console.error('[Jitsi] Error disposing on close:', e);
      }
    }
    
    // Call props close
    if (propsRef.current.onClose) {
        propsRef.current.onClose();
    }
  }, [updateAttendanceOnLeave]);

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

      {/* NEW: Start Class Overlay - Solves Browser Autoplay Blocking */}
      {!hasJoined && !isLoading && !connectionError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-20">
          <div className="text-center max-w-md px-4 animate-in fade-in zoom-in duration-300">
            <div className="h-20 w-20 rounded-full bg-blue-600/20 flex items-center justify-center mx-auto mb-6">
              <Video className="h-10 w-10 text-blue-500" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Ready to Join?</h3>
            <p className="text-gray-400 mb-8">
              Class: {subject} <br/>
              Batch: {batch}
            </p>
            <Button 
              size="lg" 
              onClick={handleStartClass}
              className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6 h-auto rounded-full shadow-lg shadow-blue-900/20 transition-transform hover:scale-105"
            >
              <Play className="mr-2 h-5 w-5 fill-current" />
              Join Class Now
            </Button>
            <p className="text-xs text-gray-500 mt-6">
              Clicking join ensures a stable connection to the classroom.
            </p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !connectionError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-20">
          <div className="text-center max-w-md px-4">
            {!showFallbackPrompt ? (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-white">{loadingMessage}</p>
                <p className="text-gray-400 text-sm mt-2">This may take a few seconds</p>
                <Button 
                  variant="link" 
                  onClick={openInNewTab}
                  className="text-blue-400 hover:text-blue-300 mt-4"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Having trouble? Open in new tab
                </Button>
              </>
            ) : (
              <>
                <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-6 w-6 text-yellow-400" />
                </div>
                <p className="text-white text-lg font-semibold">Taking longer than expected</p>
                <p className="text-gray-400 text-sm mt-2 mb-6">
                  The embedded video may be blocked by your browser. Try opening in a new tab for a better experience.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button 
                    onClick={openInNewTab}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open in New Tab
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleRetry}
                    className="border-gray-500 text-gray-300 hover:bg-gray-700"
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
              </>
            )}
          </div>
        </div>
      )}

      {/* Connection Error state */}
      {connectionError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-20">
          <div className="text-center max-w-md px-4">
            <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <X className="h-6 w-6 text-red-400" />
            </div>
            <p className="text-white text-lg font-semibold">Failed to connect to class</p>
            <p className="text-gray-400 text-sm mt-2 mb-6">
              Please check your internet connection. If the problem persists, try opening the class in a new tab.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                onClick={handleRetry}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button 
                variant="outline" 
                onClick={openInNewTab}
                className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in New Tab
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
      {!connectionError && hasJoined && !isLoading && (
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
      <div ref={jitsiContainerRef} className={`flex-1 pt-16 pb-20 w-full h-full ${!hasJoined ? 'hidden' : ''}`} />
    </div>
  );
};
