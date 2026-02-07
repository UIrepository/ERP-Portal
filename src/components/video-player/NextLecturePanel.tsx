/**
 * Next Lecture Panel Component
 * Shows a list of upcoming/available lectures for quick navigation
 */

import { PlayCircle, CheckCircle2, Clock, BookOpen } from 'lucide-react';
import { Lecture } from './types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NextLecturePanelProps {
  lectures: Lecture[];
  currentLectureId: string;
  onSelectLecture: (lecture: Lecture) => void;
}

export const NextLecturePanel = ({ 
  lectures, 
  currentLectureId, 
  onSelectLecture 
}: NextLecturePanelProps) => {
  // Find current lecture index
  const currentIndex = lectures.findIndex(l => l.id === currentLectureId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-zinc-700">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          All Lectures
        </h3>
        <p className="text-sm text-zinc-400 mt-1">
          {currentIndex + 1} of {lectures.length} lectures
        </p>
      </div>

      {/* Lectures List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {lectures.map((lecture, index) => {
            const isCurrent = lecture.id === currentLectureId;
            const isCompleted = lecture.isCompleted;
            const isUpcoming = index > currentIndex;

            return (
              <button
                key={lecture.id}
                onClick={() => onSelectLecture(lecture)}
                className={cn(
                  "w-full flex items-start gap-3 p-3 rounded-lg transition-all text-left group",
                  isCurrent 
                    ? "bg-primary/20 border border-primary/30" 
                    : "hover:bg-zinc-800/80 border border-transparent",
                  isCompleted && !isCurrent && "opacity-70"
                )}
              >
                {/* Thumbnail / Index */}
                <div className={cn(
                  "w-16 h-10 rounded flex items-center justify-center flex-shrink-0 relative overflow-hidden",
                  isCurrent ? "bg-primary/30" : "bg-zinc-700"
                )}>
                  {lecture.thumbnail ? (
                    <img 
                      src={lecture.thumbnail} 
                      alt={lecture.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-bold text-zinc-400">
                      {index + 1}
                    </span>
                  )}
                  
                  {/* Playing indicator */}
                  {isCurrent && (
                    <div className="absolute inset-0 bg-primary/40 flex items-center justify-center">
                      <PlayCircle className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>

                {/* Lecture Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className={cn(
                      "text-sm font-medium line-clamp-2",
                      isCurrent ? "text-primary" : "text-white group-hover:text-primary/90"
                    )}>
                      {lecture.title}
                    </h4>
                    
                    {/* Status indicator */}
                    {isCompleted && !isCurrent && (
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    {lecture.subject && (
                      <span className="text-xs text-zinc-500">
                        {lecture.subject}
                      </span>
                    )}
                    {lecture.duration && (
                      <span className="text-xs text-zinc-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {lecture.duration}
                      </span>
                    )}
                  </div>

                  {/* Current indicator */}
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 text-xs text-primary mt-2">
                      <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      Now Playing
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Quick Navigation */}
      {currentIndex < lectures.length - 1 && (
        <div className="p-4 border-t border-zinc-700 bg-zinc-900/50">
          <button
            onClick={() => onSelectLecture(lectures[currentIndex + 1])}
            className="w-full flex items-center justify-between p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-3">
              <PlayCircle className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <p className="text-xs text-zinc-400">Up Next</p>
                <p className="text-sm text-white font-medium line-clamp-1">
                  {lectures[currentIndex + 1].title}
                </p>
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
