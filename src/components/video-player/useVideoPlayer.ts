/**
 * Custom hook for video player logic and state management
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ParsedVideoUrl } from './types';

// Import YouTube types
/// <reference path="./youtube.d.ts" />

// Parse video URL to determine source type and extract ID
export const parseVideoUrl = (url: string): ParsedVideoUrl => {
  // YouTube patterns
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of youtubePatterns) {
    const match = url.match(pattern);
    if (match) {
      return { type: 'youtube', videoId: match[1], url };
    }
  }

  // Check if it's a direct video file (MP4, WebM, etc.)
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
  if (videoExtensions.some(ext => url.toLowerCase().includes(ext))) {
    return { type: 'mp4', url };
  }

  // Default to direct link (could be any hosted video)
  return { type: 'direct', url };
};

// YouTube Player type for ref
type YouTubePlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  mute: () => void;
  unMute: () => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  getDuration: () => number;
  getCurrentTime: () => number;
  getVideoLoadedFraction: () => number;
  destroy: () => void;
} | null;

export const useVideoPlayer = () => {
  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [showControls, setShowControls] = useState(true);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const youtubePlayerRef = useRef<YouTubePlayer>(null);
  const seekingRef = useRef(false);

  // Control visibility logic
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  // Play/Pause toggle
  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    } else if (youtubePlayerRef.current) {
      if (isPlaying) {
        youtubePlayerRef.current.pauseVideo();
      } else {
        youtubePlayerRef.current.playVideo();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  // Seek to specific time
  const seek = useCallback((time: number) => {
    // Set seeking flag to prevent interval from overwriting the seek position
    seekingRef.current = true;
    
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    } else if (youtubePlayerRef.current) {
      youtubePlayerRef.current.seekTo(time, true);
      setCurrentTime(time);
    }
    
    // Clear seeking flag after YouTube has time to update
    setTimeout(() => {
      seekingRef.current = false;
    }, 500);
  }, []);

  // Skip forward/backward
  const skipForward = useCallback(() => {
    seek(Math.min(currentTime + 10, duration));
  }, [currentTime, duration, seek]);

  const skipBackward = useCallback(() => {
    seek(Math.max(currentTime - 10, 0));
  }, [currentTime, seek]);

  // Volume control
  const changeVolume = useCallback((newVolume: number) => {
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    } else if (youtubePlayerRef.current) {
      youtubePlayerRef.current.setVolume(newVolume * 100);
    }
  }, []);

  // Mute toggle
  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    } else if (youtubePlayerRef.current) {
      if (isMuted) {
        youtubePlayerRef.current.unMute();
      } else {
        youtubePlayerRef.current.mute();
      }
    }
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Playback speed
  const changeSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    } else if (youtubePlayerRef.current) {
      youtubePlayerRef.current.setPlaybackRate(speed);
    }
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'arrowright':
          e.preventDefault();
          skipForward();
          break;
        case 'arrowleft':
          e.preventDefault();
          skipBackward();
          break;
        case 'arrowup':
          e.preventDefault();
          changeVolume(Math.min(volume + 0.1, 1));
          break;
        case 'arrowdown':
          e.preventDefault();
          changeVolume(Math.max(volume - 0.1, 0));
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case ',':
          e.preventDefault();
          changeSpeed(Math.max(playbackSpeed - 0.25, 0.25));
          break;
        case '.':
          e.preventDefault();
          changeSpeed(Math.min(playbackSpeed + 0.25, 2));
          break;
      }
      showControlsTemporarily();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, skipForward, skipBackward, changeVolume, volume, toggleMute, toggleFullscreen, changeSpeed, playbackSpeed, showControlsTemporarily]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return {
    // State
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
    // Refs
    videoRef,
    containerRef,
    youtubePlayerRef,
    seekingRef,
    // Actions
    togglePlayPause,
    seek,
    skipForward,
    skipBackward,
    changeVolume,
    toggleMute,
    changeSpeed,
    toggleFullscreen,
    showControlsTemporarily,
  };
};

// Global window type augmentation for YouTube API
declare global {
  interface Window {
    YT: {
      Player: new (elementId: string | HTMLElement, options: {
        videoId?: string;
        playerVars?: Record<string, number | string>;
        events?: {
          onReady?: (event: { target: YouTubePlayer }) => void;
          onStateChange?: (event: { data: number }) => void;
        };
      }) => YouTubePlayer;
      PlayerState: {
        UNSTARTED: -1;
        ENDED: 0;
        PLAYING: 1;
        PAUSED: 2;
        BUFFERING: 3;
        CUED: 5;
      };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}
