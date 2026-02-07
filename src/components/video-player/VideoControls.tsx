/**
 * Custom video controls overlay component
 * Features: Play/Pause, Seek, Volume, Speed, Fullscreen
 */

import { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize,
  SkipForward,
  SkipBack,
  Settings,
  ChevronUp
} from 'lucide-react';
import { VideoControlsProps } from './types';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';

// Format time in MM:SS or HH:MM:SS
const formatTime = (seconds: number): string => {
  if (isNaN(seconds)) return '0:00';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export const VideoControls = ({
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  playbackSpeed,
  isFullscreen,
  buffered,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onSpeedChange,
  onFullscreenToggle,
  onSkipForward,
  onSkipBackward,
}: VideoControlsProps) => {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Calculate progress percentage
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;

  // Handle progress bar click/drag
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    onSeek(percent * duration);
  };

  // Handle progress bar hover for preview
  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    setSeekPreview(percent * duration);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-16 pb-4 px-4 transition-opacity duration-300">
      {/* Progress Bar */}
      <div 
        ref={progressRef}
        className="relative h-1.5 bg-white/20 rounded-full cursor-pointer group mb-4 hover:h-2 transition-all"
        onClick={handleProgressClick}
        onMouseMove={handleProgressHover}
        onMouseLeave={() => setSeekPreview(null)}
      >
        {/* Buffered progress */}
        <div 
          className="absolute top-0 left-0 h-full bg-white/30 rounded-full"
          style={{ width: `${bufferedPercent}%` }}
        />
        
        {/* Current progress */}
        <div 
          className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all"
          style={{ width: `${progressPercent}%` }}
        />
        
        {/* Seek preview indicator */}
        {seekPreview !== null && (
          <div 
            className="absolute -top-8 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded"
            style={{ left: `${(seekPreview / duration) * 100}%` }}
          >
            {formatTime(seekPreview)}
          </div>
        )}
        
        {/* Progress handle */}
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          style={{ left: `calc(${progressPercent}% - 8px)` }}
        />
      </div>

      {/* Controls Row */}
      <div className="flex items-center justify-between">
        {/* Left Controls */}
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button
            onClick={onPlayPause}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 text-white" fill="white" />
            ) : (
              <Play className="w-6 h-6 text-white" fill="white" />
            )}
          </button>

          {/* Skip Backward */}
          <button
            onClick={onSkipBackward}
            className="p-2 hover:bg-white/10 rounded-full transition-colors group"
            aria-label="Skip backward 10 seconds"
          >
            <SkipBack className="w-5 h-5 text-white" />
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-white opacity-0 group-hover:opacity-100 whitespace-nowrap">
              -10s
            </span>
          </button>

          {/* Skip Forward */}
          <button
            onClick={onSkipForward}
            className="p-2 hover:bg-white/10 rounded-full transition-colors group"
            aria-label="Skip forward 10 seconds"
          >
            <SkipForward className="w-5 h-5 text-white" />
            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-white opacity-0 group-hover:opacity-100 whitespace-nowrap">
              +10s
            </span>
          </button>

          {/* Volume Control */}
          <div 
            className="relative flex items-center"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button
              onClick={onMuteToggle}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-5 h-5 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
            </button>
            
            {/* Volume Slider */}
            <div className={cn(
              "flex items-center overflow-hidden transition-all duration-200",
              showVolumeSlider ? "w-24 opacity-100 ml-2" : "w-0 opacity-0"
            )}>
              <Slider
                value={[isMuted ? 0 : volume * 100]}
                max={100}
                step={1}
                onValueChange={([val]) => onVolumeChange(val / 100)}
                className="w-full"
              />
            </div>
          </div>

          {/* Time Display */}
          <span className="text-white text-sm font-medium ml-2">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Settings Menu (Speed, Quality) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-2 hover:bg-white/10 rounded-full transition-colors flex items-center gap-1"
                aria-label="Settings"
              >
                <Settings className="w-5 h-5 text-white" />
                {playbackSpeed !== 1 && (
                  <span className="text-xs text-white">{playbackSpeed}x</span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className="bg-zinc-900/95 border-zinc-700 text-white min-w-[180px]"
            >
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="hover:bg-white/10 focus:bg-white/10">
                  <span>Playback Speed</span>
                  <span className="ml-auto text-muted-foreground">{playbackSpeed}x</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="bg-zinc-900/95 border-zinc-700 text-white">
                    {PLAYBACK_SPEEDS.map((speed) => (
                      <DropdownMenuItem
                        key={speed}
                        onClick={() => onSpeedChange(speed)}
                        className={cn(
                          "hover:bg-white/10 focus:bg-white/10 cursor-pointer",
                          playbackSpeed === speed && "bg-white/20"
                        )}
                      >
                        {speed === 1 ? 'Normal' : `${speed}x`}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Fullscreen Toggle */}
          <button
            onClick={onFullscreenToggle}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <Minimize className="w-5 h-5 text-white" />
            ) : (
              <Maximize className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="absolute bottom-full left-4 mb-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="text-xs text-white/60 flex gap-4">
          <span>Space: Play/Pause</span>
          <span>←/→: Seek</span>
          <span>↑/↓: Volume</span>
          <span>F: Fullscreen</span>
        </div>
      </div>
    </div>
  );
};
