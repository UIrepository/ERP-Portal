/**
 * Type definitions for the FullScreenVideoPlayer component
 */

export interface Lecture {
  id: string;
  title: string;
  subject?: string;
  duration?: string;
  thumbnail?: string;
  videoUrl: string;
  isCompleted?: boolean;
}

export interface Doubt {
  id: string;
  question: string;
  askedBy: string;
  askedAt: Date;
  answer?: string;
  answeredBy?: string;
  answeredAt?: Date;
}

export interface VideoPlayerProps {
  /** Current lecture being played */
  currentLecture: Lecture;
  /** List of all lectures for navigation */
  lectures: Lecture[];
  /** Doubts for the current lecture */
  doubts?: Doubt[];
  /** Callback when a new lecture is selected */
  onLectureChange?: (lecture: Lecture) => void;
  /** Callback when a new doubt is submitted */
  onDoubtSubmit?: (question: string) => void;
  /** Callback to close the player */
  onClose?: () => void;
  /** User name for doubt submissions */
  userName?: string;
}

export interface VideoControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackSpeed: number;
  isFullscreen: boolean;
  buffered: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onSpeedChange: (speed: number) => void;
  onFullscreenToggle: () => void;
  onSkipForward: () => void;
  onSkipBackward: () => void;
  onToggleDoubts?: () => void;
  onToggleLectures?: () => void;
}

export type VideoSource = 'youtube' | 'mp4' | 'direct';

export interface ParsedVideoUrl {
  type: VideoSource;
  videoId?: string;
  url: string;
}
