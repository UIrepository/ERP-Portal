/**
 * FullScreenVideoPlayer Component
 * * A professional, distraction-free video player for coaching platforms.
 * Supports YouTube embeds (with hidden branding) and direct video files.
 * * Features:
 * - Custom controls (play/pause, seek, volume, speed, fullscreen)
 * - Auto-hiding controls overlay
 * - Right sidebar with Doubts and Next Lecture panels
 * - Keyboard shortcuts support
 * - Smooth transitions and dark theme
 * - Prevents YouTube redirects and hides external branding
 * - Vignette effect at start/end to hide YouTube branding
 * - Video progress tracking with resume functionality
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ChevronRight, Play } from 'lucide-react';
import { VideoPlayerProps, Lecture } from './types';
import { useVideoPlayer, parseVideoUrl } from './useVideoPlayer';
import { VideoControls } from './VideoControls';
import { DoubtsPanel } from './DoubtsPanel';
import { NextLecturePanel } from './NextLecturePanel';
import { useVideoProgress } from '@/hooks/useVideoProgress';
import { cn } from '@/lib/utils';
// Button import removed as it's no longer used for the top toggle

type SidebarTab = 'doubts' | 'lectures' | null;

export const FullScreenVideoPlayer = ({
  currentLecture,
  lectures,
  doubts = [],
  onLectureChange,
  onDoubtSubmit,
  onClose,
  userName,
}: VideoPlayerProps) => {
  // Sidebar state
  const [activeSidebar, setActiveSidebar] = useState<SidebarTab>(null);
  const youtubeInitialized = useRef(false);
  const [showVignette, setShowVignette] = useState(true); // Show vignette at start
  const progressLoadedRef = useRef(false);
  
  // Video player hook
  const {
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    volume,
    isMuted,
    playbackSpeed,
    isFullscreen,
    buffered,
    setBuffered,
    showControls,
    videoRef,
    containerRef,
    youtubePlayerRef,
    togglePlayPause,
    seek,
    skipForward,
    skipBackward,
    changeVolume,
    toggleMute,
    changeSpeed,
    toggleFullscreen,
    showControlsTemporarily,
  } = useVideoPlayer();

  // Video progress tracking hook
  const { fetchProgress, saveProgress, startAutoSave, stopAutoSave } = useVideoProgress(currentLecture.id);

  // Parse video URL
  const videoSource = parseVideoUrl(currentLecture.videoUrl);

  // Compute vignette visibility - show during first 1 sec and last 1 sec
  const shouldShowVignette = showVignette || (duration > 0 && currentTime > 0 && (duration - currentTime) <= 1);

  // Toggle sidebar
  const toggleSidebar = (tab: SidebarTab) => {
    setActiveSidebar(prev => prev === tab ? null : tab);
  };

  // Handle lecture change
  const handleLectureChange = useCallback((lecture: Lecture) => {
    // Save progress before switching
    saveProgress(currentTime, duration);
    progressLoadedRef.current = false;
    setShowVignette(true);
    onLectureChange?.(lecture);
  }, [onLectureChange, saveProgress, currentTime, duration]);

  // Handle doubt submission
  const handleDoubtSubmit = useCallback((question: string) => {
    onDoubtSubmit?.(question);
  }, [onDoubtSubmit]);

  // Handle close - save progress before closing
  const handleClose = useCallback(() => {
    saveProgress(currentTime, duration);
    stopAutoSave();
    onClose?.();
  }, [onClose, saveProgress, currentTime, duration, stopAutoSave]);

  // Video event handlers for HTML5 video
  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      
      // Hide vignette after 1 second
      if (videoRef.current.currentTime > 1 && showVignette) {
        setShowVignette(false);
      }
    }
  };

  const handleVideoLoadedMetadata = async () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      
      // Load saved progress and seek to it
      if (!progressLoadedRef.current) {
        progressLoadedRef.current = true;
        const savedProgress = await fetchProgress();
        if (savedProgress > 0 && videoRef.current) {
          videoRef.current.currentTime = savedProgress;
          // If resuming past first second, hide vignette
          if (savedProgress > 1) {
            setShowVignette(false);
          }
        }
        
        // Start auto-saving progress
        startAutoSave(
          () => videoRef.current?.currentTime || 0,
          () => videoRef.current?.duration || 0
        );
      }
    }
  };

  const handleVideoProgress = () => {
    if (videoRef.current && videoRef.current.buffered.length > 0) {
      setBuffered(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
    }
  };

  const handleVideoPlay = () => setIsPlaying(true);
  const handleVideoPause = () => setIsPlaying(false);

  // YouTube IFrame API setup
  useEffect(() => {
    if (videoSource.type !== 'youtube' || !videoSource.videoId) return;
    if (youtubeInitialized.current) return;

    const initPlayer = async () => {
      if (!window.YT?.Player) return;
      
      youtubeInitialized.current = true;

      // Load saved progress first
      let startTime = 0;
      if (!progressLoadedRef.current) {
        progressLoadedRef.current = true;
        startTime = await fetchProgress();
        if (startTime > 1) {
          setShowVignette(false);
        }
      }

      const player = new window.YT.Player('youtube-player', {
        videoId: videoSource.videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          fs: 0,
          disablekb: 1,
          playsinline: 1,
          origin: window.location.origin,
          // Hide end screen recommendations and related videos
          endscreen: 0,
          // Prevent showing related videos at the end
          autoplay_on_end: 0,
          // Start from saved position if available
          start: Math.floor(startTime),
        },
        events: {
          onReady: (event) => {
            if (event.target) {
              setDuration(event.target.getDuration());
              event.target.playVideo();
              youtubePlayerRef.current = event.target;
              
              // Start auto-saving progress for YouTube
              startAutoSave(
                () => youtubePlayerRef.current?.getCurrentTime() || 0,
                () => youtubePlayerRef.current?.getDuration() || 0
              );
            }
          },
          onStateChange: (event) => {
            if (event.data === 1) { // PLAYING
              setIsPlaying(true);
            } else if (event.data === 2) { // PAUSED
              setIsPlaying(false);
            }
          },
        },
      });
    };

    // Load YouTube IFrame API if not loaded
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = initPlayer;
    } else if (window.YT.Player) {
      initPlayer();
    }

    // Update current time periodically for YouTube
    const timeUpdateInterval = setInterval(() => {
      if (youtubePlayerRef.current && typeof youtubePlayerRef.current.getCurrentTime === 'function') {
        const time = youtubePlayerRef.current.getCurrentTime();
        setCurrentTime(time);
        const loaded = youtubePlayerRef.current.getVideoLoadedFraction();
        const dur = youtubePlayerRef.current.getDuration();
        setBuffered(loaded * dur);
        
        // Hide vignette after 1 second
        if (time > 1 && showVignette) {
          setShowVignette(false);
        }
      }
    }, 250);

    return () => {
      clearInterval(timeUpdateInterval);
      // Save progress when unmounting
      if (youtubePlayerRef.current) {
        saveProgress(
          youtubePlayerRef.current.getCurrentTime(),
          youtubePlayerRef.current.getDuration()
        );
        youtubePlayerRef.current.destroy();
        youtubePlayerRef.current = null;
      }
      stopAutoSave();
      youtubeInitialized.current = false;
    };
  }, [videoSource.type, videoSource.videoId, setCurrentTime, setDuration, setIsPlaying, setBuffered, youtubePlayerRef, fetchProgress, startAutoSave, stopAutoSave, saveProgress, showVignette]);

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isFullscreen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isFullscreen, handleClose]);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex"
      onMouseMove={showControlsTemporarily}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.video-area') && !target.closest('button') && !target.closest('[role="menu"]')) {
          togglePlayPause();
        }
      }}
    >
      {/* Main Video Area */}
      <div className={cn(
        "flex-1 relative transition-all duration-300",
        activeSidebar && "mr-80"
      )}>
        {/* Close Button */}
        <button
          onClick={handleClose}
          className={cn(
            "absolute top-4 left-4 z-20 p-2 bg-black/50 hover:bg-black/70 rounded-full transition-all",
            showControls ? "opacity-100" : "opacity-0"
          )}
          aria-label="Close player"
        >
          <X className="w-6 h-6 text-white" />
        </button>

        {/* Lecture Title */}
        <div className={cn(
          "absolute top-4 left-16 right-24 z-20 transition-all",
          showControls ? "opacity-100" : "opacity-0"
        )}>
          <h2 className="text-white text-lg font-semibold truncate">
            {currentLecture.title}
          </h2>
          {currentLecture.subject && (
            <p className="text-white/60 text-sm">{currentLecture.subject}</p>
          )}
        </div>

        {/* Video Container */}
        <div className="video-area absolute inset-0 flex items-center justify-center">
          {/* YouTube Player */}
          {videoSource.type === 'youtube' && (
            <>
              <div id="youtube-player" className="w-full h-full" />
              {/* Overlay to prevent YouTube clicks */}
              <div 
                className="absolute inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayPause();
                }}
              />
            </>
          )}

          {/* HTML5 Video Player (MP4, WebM, direct links) */}
          {(videoSource.type === 'mp4' || videoSource.type === 'direct') && (
            <video
              ref={videoRef}
              src={currentLecture.videoUrl}
              className="w-full h-full object-contain"
              onTimeUpdate={handleVideoTimeUpdate}
              onLoadedMetadata={handleVideoLoadedMetadata}
              onProgress={handleVideoProgress}
              onPlay={handleVideoPlay}
              onPause={handleVideoPause}
              autoPlay
              playsInline
            />
          )}
          
          {/* Vignette overlay to hide YouTube branding at start and end */}
          <div 
            className={cn(
              "absolute inset-0 z-12 pointer-events-none transition-opacity duration-500",
              shouldShowVignette ? "opacity-100" : "opacity-0"
            )}
            style={{
              background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.85) 70%, rgba(0,0,0,1) 100%)',
            }}
          />
        </div>

        {/* Custom Controls Overlay */}
        <div className={cn(
          "absolute inset-0 z-20 pointer-events-none transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}>
          <div className="pointer-events-auto">
            <VideoControls
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              volume={volume}
              isMuted={isMuted}
              playbackSpeed={playbackSpeed}
              isFullscreen={isFullscreen}
              buffered={buffered}
              onPlayPause={togglePlayPause}
              onSeek={seek}
              onVolumeChange={changeVolume}
              onMuteToggle={toggleMute}
              onSpeedChange={changeSpeed}
              onFullscreenToggle={toggleFullscreen}
              onSkipForward={skipForward}
              onSkipBackward={skipBackward}
              // Pass the toggle handlers here
              onToggleDoubts={() => toggleSidebar('doubts')}
              onToggleLectures={() => toggleSidebar('lectures')}
            />
          </div>
        </div>

        {/* Center Play/Pause Indicator */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200",
          !isPlaying && showControls ? "opacity-100" : "opacity-0"
        )} style={{ zIndex: 15 }}>
          <div className="w-20 h-20 rounded-full bg-black/50 flex items-center justify-center">
            <Play className="w-10 h-10 text-white ml-1" fill="white" />
          </div>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className={cn(
        "fixed top-0 right-0 h-full w-80 bg-zinc-900 border-l border-zinc-700 z-30 transition-transform duration-300 ease-out",
        activeSidebar ? "translate-x-0" : "translate-x-full"
      )}>
        {/* Sidebar Close Button */}
        <button
          onClick={() => setActiveSidebar(null)}
          className="absolute top-4 left-4 p-1 hover:bg-zinc-800 rounded transition-colors z-10"
          aria-label="Close sidebar"
        >
          <ChevronRight className="w-5 h-5 text-white/60" />
        </button>

        {/* Sidebar Content */}
        {activeSidebar === 'doubts' && (
          <DoubtsPanel
            doubts={doubts}
            onSubmitDoubt={handleDoubtSubmit}
            userName={userName}
          />
        )}
        {activeSidebar === 'lectures' && (
          <NextLecturePanel
            lectures={lectures}
            currentLectureId={currentLecture.id}
            onSelectLecture={handleLectureChange}
          />
        )}
      </div>
    </div>
  );
};

export default FullScreenVideoPlayer;
