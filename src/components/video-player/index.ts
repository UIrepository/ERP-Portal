/**
 * Video Player Components Export
 * 
 * Usage:
 * 
 * import { FullScreenVideoPlayer } from '@/components/video-player';
 * 
 * <FullScreenVideoPlayer
 *   currentLecture={{
 *     id: '1',
 *     title: 'Introduction to React',
 *     subject: 'Web Development',
 *     videoUrl: 'https://youtube.com/watch?v=...',
 *     duration: '45:00',
 *   }}
 *   lectures={allLectures}
 *   doubts={lectureDoubts}
 *   onLectureChange={(lecture) => setCurrentLecture(lecture)}
 *   onDoubtSubmit={(question) => submitDoubt(question)}
 *   onClose={() => setPlayerOpen(false)}
 *   userName="John Doe"
 * />
 */

export { FullScreenVideoPlayer } from './FullScreenVideoPlayer';
export { VideoControls } from './VideoControls';
export { DoubtsPanel } from './DoubtsPanel';
export { NextLecturePanel } from './NextLecturePanel';
export { useVideoPlayer, parseVideoUrl } from './useVideoPlayer';
export type { 
  VideoPlayerProps, 
  Lecture, 
  Doubt, 
  VideoControlsProps,
  VideoSource,
  ParsedVideoUrl 
} from './types';
