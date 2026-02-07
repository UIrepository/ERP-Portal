/**
 * Custom video controls overlay component
 * Fixes: Seek functionality, removes text from skip buttons, ensures pointer events work
 * Fixes: Settings menu z-index to appear above the player
 */

import { useState, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize,
  SkipBack,
  SkipForward,
  Settings,
  FileText,
  ListVideo,
  Check
} from 'lucide-react';
import { VideoControlsProps } from './types';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { useIsMobile } from '@/hooks/use-mobile';
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
const VIDEO_QUALITIES = ['Auto', '1080p', '720p', '480p', '360p'];

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
  onToggleDoubts,
  onToggleLectures,
}: VideoControlsProps) => {
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  const [currentQuality, setCurrentQuality] = useState('Auto');
  const progressRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Calculate progress percentage
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (buffered / duration) * 100 : 0;

  // Handle progress bar click/drag
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation(); // Prevent play/pause toggle
    
    // Use currentTarget to ensure we get the dimensions of the clickable div
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    
    // Safety check for zero width
    if (rect.width === 0 || duration <= 0) return;

    const percent = (e.clientX - rect.left) / rect.width;
    // Clamp between 0 and duration
    const newTime = Math.max(0, Math.min(percent * duration, duration));
    
    onSeek(newTime);
  };

  // Handle progress bar hover for preview
  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = e.currentTarget;
    const rect = bar.getBoundingClientRect();
    if (rect.width === 0 || duration <= 0) return;

    const percent = (e.clientX - rect.left) / rect.width;
    const previewTime = Math.max(0, Math.min(percent * duration, duration));
    setSeekPreview(previewTime);
  };

  return (
    <div 
      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/80 to-transparent pt-12 pb-4 px-4 transition-opacity duration-300 pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
    >
      
      {/* Top Row: Time | Speed | Progress | Total Time */}
      <div className="flex items-center gap-3 mb-3 px-1">
        <span className="text-white/90 text-xs font-medium min-w-[40px]">
          {formatTime(currentTime)}
        </span>
        
        {playbackSpeed !== 1 && (
           <span className="border border-white/50 text-white/90 text-[10px] px-1 rounded font-bold">
             {playbackSpeed}x
           </span>
        )}

        {/* Progress Bar Container */}
        <div 
          ref={progressRef}
          className="relative flex-1 h-1 group cursor-pointer py-3 select-none" // Increased click area
          onClick={handleProgressClick}
          onMouseMove={handleProgressHover}
          onMouseLeave={() => setSeekPreview(null)}
        >
          {/* Track Background - Inner elements allow bubbling to parent onClick */}
          <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-white/20 rounded-full overflow-hidden">
             {/* Buffered progress */}
            <div 
              className="absolute top-0 left-0 h-full bg-white/30"
              style={{ width: `${bufferedPercent}%` }}
            />
            {/* Current progress */}
            <div 
              className="absolute top-0 left-0 h-full bg-primary"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Hover Preview Tooltip */}
          {seekPreview !== null && (
            <div 
              className="absolute bottom-6 transform -translate-x-1/2 bg-black/90 border border-white/10 text-white text-xs px-2 py-1 rounded shadow-xl pointer-events-none"
              style={{ left: `${(seekPreview / duration) * 100}%` }}
            >
              {formatTime(seekPreview)}
            </div>
          )}
          
          {/* Progress handle (visible on hover) */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg pointer-events-none"
            style={{ left: `calc(${progressPercent}% - 6px)` }}
          />
        </div>

        <span className="text-white/50 text-xs font-medium min-w-[40px] text-right">
          {formatTime(duration)}
        </span>
      </div>

      {/* Bottom Row: Controls */}
      <div className="flex items-center justify-between">
        
        {/* Left Controls Group */}
        <div className="flex items-center gap-4">
          {/* Play/Pause */}
          <button
            onClick={onPlayPause}
            className="text-white/70 hover:text-white transition-colors"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7" fill="currentColor" />
            ) : (
              <Play className="w-7 h-7" fill="currentColor" />
            )}
          </button>

          {/* Skip Backward 10s (Icon Only) */}
          <button
            onClick={onSkipBackward}
            className="text-white/70 hover:text-white transition-colors flex items-center justify-center"
            aria-label="Skip backward 10 seconds"
          >
            <SkipBack className="w-6 h-6" />
          </button>

          {/* Skip Forward 10s (Icon Only) */}
          <button
            onClick={onSkipForward}
            className="text-white/70 hover:text-white transition-colors flex items-center justify-center"
            aria-label="Skip forward 10 seconds"
          >
            <SkipForward className="w-6 h-6" />
          </button>

          {/* Volume Control */}
          <div 
            className="flex items-center group relative"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button
              onClick={onMuteToggle}
              className="text-white/70 hover:text-white transition-colors"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-6 h-6" />
              ) : (
                <Volume2 className="w-6 h-6" />
              )}
            </button>
            
            {/* Volume Slider - Reveal on Hover */}
            <div className={cn(
              "overflow-hidden transition-all duration-200 ease-out origin-left flex items-center",
              showVolumeSlider ? "w-24 ml-3 opacity-100" : "w-0 opacity-0"
            )}>
              <Slider
                value={[volume * 100]}
                max={100}
                step={1}
                onValueChange={([val]) => onVolumeChange(val / 100)}
                className="w-full cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Right Controls Group */}
        <div className="flex items-center gap-5">
          
          {/* Lectures List Button */}
          {onToggleLectures && (
            <button
              onClick={onToggleLectures}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Lectures"
              title="Lectures List"
            >
              <ListVideo className="w-6 h-6" />
            </button>
          )}

          {/* Doubts Button (PDF-like symbol) */}
          {onToggleDoubts && (
            <button
              onClick={onToggleDoubts}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Doubts"
              title="Doubts & Notes"
            >
              <FileText className="w-5 h-5" />
            </button>
          )}

          {/* Settings Menu (Quality & Speed) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="text-white/70 hover:text-white transition-colors rotate-0 hover:rotate-45 duration-300"
                aria-label="Settings"
              >
                <Settings className="w-6 h-6" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              sideOffset={10}
              // UPDATE: Added z-[2147483647] to ensure menu appears above the video player
              className="bg-zinc-900/95 border-zinc-700 text-white min-w-[220px] backdrop-blur-sm z-[2147483647]"
            >
              {/* Playback Speed Submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="hover:bg-white/10 focus:bg-white/10 h-10">
                  <span>Playback Speed</span>
                  <span className="ml-auto text-zinc-400 text-xs">{playbackSpeed}x</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  {/* UPDATE: Added z-[2147483647] to ensure submenu appears above the video player */}
                  <DropdownMenuSubContent className="bg-zinc-900/95 border-zinc-700 text-white z-[2147483647]">
                    {PLAYBACK_SPEEDS.map((speed) => (
                      <DropdownMenuItem
                        key={speed}
                        onClick={() => onSpeedChange(speed)}
                        className="hover:bg-white/10 focus:bg-white/10 cursor-pointer justify-between"
                      >
                        {speed === 1 ? 'Normal' : `${speed}x`}
                        {playbackSpeed === speed && <Check className="w-4 h-4 ml-2" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              {/* Video Quality Submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="hover:bg-white/10 focus:bg-white/10 h-10">
                  <span>Video Quality</span>
                  <span className="ml-auto text-zinc-400 text-xs">{currentQuality}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  {/* UPDATE: Added z-[2147483647] to ensure submenu appears above the video player */}
                  <DropdownMenuSubContent className="bg-zinc-900/95 border-zinc-700 text-white z-[2147483647]">
                    {VIDEO_QUALITIES.map((q) => (
                      <DropdownMenuItem
                        key={q}
                        onClick={() => setCurrentQuality(q)}
                        className="hover:bg-white/10 focus:bg-white/10 cursor-pointer justify-between"
                      >
                        {q}
                        {currentQuality === q && <Check className="w-4 h-4 ml-2" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Fullscreen Toggle - Hidden on mobile */}
          {!isMobile && (
            <button
              onClick={onFullscreenToggle}
              className="text-white/70 hover:text-white transition-colors"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? (
                <Minimize className="w-6 h-6" />
              ) : (
                <Maximize className="w-6 h-6" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
