/**
 * Next Lecture Panel Component
 * Design: X-style Dark Theme (Clean list, no clutter)
 */

import { Play, CheckCircle2, Lock } from 'lucide-react';
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
  return (
    <div className="flex flex-col h-full bg-black text-[#e7e9ea]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/65 backdrop-blur-md border-b border-[#2f3336] p-3">
        <h3 className="text-xl font-bold">Playlist</h3>
        <p className="text-[13px] text-[#71767b]">{lectures.length} videos</p>
      </div>

      {/* Lectures List */}
      <ScrollArea className="flex-1 w-full">
        <div className="flex flex-col pb-20"> {/* Added padding bottom for mobile drawer safety */}
          {lectures.map((lecture, index) => {
            const isCurrent = lecture.id === currentLectureId;

            return (
              <div 
                key={lecture.id}
                onClick={() => onSelectLecture(lecture)}
                className={cn(
                  "group relative flex gap-3 p-3 border-b border-[#2f3336] cursor-pointer transition-colors",
                  isCurrent ? "bg-white/5" : "hover:bg-white/5"
                )}
              >
                {/* Active Indicator (Blue Bar) */}
                {isCurrent && (
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#1d9bf0]" />
                )}

                {/* Thumbnail Container */}
                <div className="relative w-[100px] h-[56px] bg-[#16181c] rounded overflow-hidden border border-[#2f3336] flex-shrink-0 flex items-center justify-center">
                  {lecture.thumbnail ? (
                    <img 
                      src={lecture.thumbnail} 
                      alt=""
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                  ) : (
                    // Fallback Icon
                    <div className="flex items-center justify-center w-full h-full">
                      {isCurrent ? (
                         <div className="w-3 h-3 bg-[#1d9bf0] rounded-sm animate-pulse" />
                      ) : (
                        <Play className="w-5 h-5 text-[#71767b]" fill="currentColor" />
                      )}
                    </div>
                  )}
                  
                  {/* Duration Badge */}
                  {lecture.duration && (
                    <div className="absolute bottom-1 right-1 bg-black/80 text-[#e7e9ea] text-[10px] font-medium px-1 rounded">
                      {lecture.duration}
                    </div>
                  )}
                </div>

                {/* Info Section */}
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className={cn(
                      "text-[14px] leading-tight font-normal line-clamp-2",
                      isCurrent ? "text-[#e7e9ea] font-medium" : "text-[#e7e9ea]"
                    )}>
                      {index + 1}. {lecture.title}
                    </h4>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {lecture.subject && (
                      <span className="text-[13px] text-[#71767b] truncate">
                        {lecture.subject}
                      </span>
                    )}
                    {lecture.isCompleted && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#00ba7c]" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
