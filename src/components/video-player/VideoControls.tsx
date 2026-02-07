/**
 * Custom video controls overlay component
 * Features: Play/Pause, Seek, Volume, Speed, Fullscreen, Sidebar Toggles
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
  FileText, // PDF-like symbol for Doubts
  ListVideo, // List symbol for Lectures
  Check
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/80 to-transparent pt-12 pb-4 px-4 transition-opacity duration-300">
      
      {/* Top Row: Time | Speed | Progress | Total Time */}
      <div className="flex items-center gap-3 mb-3 px-1">
        <span className="text-white text-xs font-medium min-w-[40px]">
          {formatTime(currentTime)}
        </span>
        
        {playbackSpeed !== 1 && (
           <span className="border border-white/50 text-white text-[10px] px-1 rounded font-bold">
             {playbackSpeed}x
           </span>
        )}

        {/* Progress Bar Container */}
        <div 
          ref={progressRef}
          className="relative flex-1 h-1 group cursor-pointer py-2" // Added py-2 to increase clickable area
          onClick={handleProgressClick}
          onMouseMove={handleProgressHover}
          onMouseLeave={() => setSeekPreview(null)}
        >
          {/* Track Background */}
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
              className="absolute bottom-4 transform -translate-x-1/2 bg-black/90 border border-white/10 text-white text-xs px-2 py-1 rounded shadow-xl"
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

        <span className="text-white/70 text-xs font-medium min-w-[40px] text-right">
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
            className="hover:opacity-80 transition-opacity"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 text-white" fill="white" />
            ) : (
              <Play className="w-7 h-7 text-white" fill="white" />
            )}
          </button>

          {/* Skip Backward 10s */}
          <button
            onClick={onSkipBackward}
            className="relative flex items-center justify-center hover:opacity-80 transition-opacity group"
            aria-label="Skip backward 10 seconds"
          >
            <SkipBack className="w-6 h-6 text-white" />
            <span className="absolute text-[8px] font-bold text-white top-[7px]">10</span>
          </button>

          {/* Skip Forward 10s */}
          <button
            onClick={onSkipForward}
            className="relative flex items-center justify-center hover:opacity-80 transition-opacity group"
            aria-label="Skip forward 10 seconds"
          >
            <SkipForward className="w-6 h-6 text-white" />
            <span className="absolute text-[8px] font-bold text-white top-[7px]">10</span>
          </button>

          {/* Volume Control */}
          <div 
            className="flex items-center group relative"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button
              onClick={onMuteToggle}
              className="hover:opacity-80 transition-opacity"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-6 h-6 text-white" />
              ) : (
                <Volume2 className="w-6 h-6 text-white" />
              )}
            </button>
            
            {/* Volume Slider - Reveal on Hover */}
            <div className={cn(
              "overflow-hidden transition-all duration-200 ease-out origin-left flex items-center",
              showVolumeSlider ? "w-24 ml-3 opacity-100" : "w-0 opacity-0"
            )}>
              <Slider
                value={[isMuted ? 0 : volume * 100]}
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
              className="hover:opacity-80 transition-opacity"
              aria-label="Lectures"
              title="Lectures List"
            >
              <ListVideo className="w-6 h-6 text-white" />
            </button>
          )}

          {/* Doubts Button (PDF-like symbol) */}
          {onToggleDoubts && (
            <button
              onClick={onToggleDoubts}
              className="hover:opacity-80 transition-opacity"
              aria-label="Doubts"
              title="Doubts & Notes"
            >
              <FileText className="w-5 h-5 text-white" />
            </button>
          )}

          {/* Settings Menu (Quality & Speed) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="hover:opacity-80 transition-opacity rotate-0 hover:rotate-45 duration-300"
                aria-label="Settings"
              >
                <Settings className="w-6 h-6 text-white" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              sideOffset={10}
              className="bg-zinc-900/95 border-zinc-700 text-white min-w-[220px] backdrop-blur-sm"
            >
              {/* Playback Speed Submenu */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="hover:bg-white/10 focus:bg-white/10 h-10">
                  <span>Playback Speed</span>
                  <span className="ml-auto text-zinc-400 text-xs">{playbackSpeed}x</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="bg-zinc-900/95 border-zinc-700 text-white">
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
                  <DropdownMenuSubContent className="bg-zinc-900/95 border-zinc-700 text-white">
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

          {/* Fullscreen Toggle */}
          <button
            onClick={onFullscreenToggle}
            className="hover:opacity-80 transition-opacity"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? (
              <Minimize className="w-6 h-6 text-white" />
            ) : (
              <Maximize className="w-6 h-6 text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
