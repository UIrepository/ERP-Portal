/**
 * Doubts Panel Component
 * Features:
 * - Social feed style (Dark theme)
 * - Input field at the bottom
 * - Avatars and Usernames removed as requested
 */

import { useState, useRef, useEffect } from 'react';
import { Send, CheckCircle2 } from 'lucide-react';
import { Doubt } from './types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';

interface DoubtsPanelProps {
  doubts: Doubt[];
  onSubmitDoubt: (question: string) => void;
  userName?: string;
}

export const DoubtsPanel = ({ doubts, onSubmitDoubt }: DoubtsPanelProps) => {
  const [newQuestion, setNewQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new doubts arrive
  useEffect(() => {
    if (scrollRef.current) {
      const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }
    }
  }, [doubts.length]);

  const handleSubmit = async () => {
    if (!newQuestion.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmitDoubt(newQuestion.trim());
      setNewQuestion('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full bg-black text-[#e7e9ea]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/65 backdrop-blur-md border-b border-[#2f3336] p-3">
        <h3 className="text-xl font-bold">Doubts</h3>
        <p className="text-[13px] text-[#71767b]">{doubts.length} questions in this lecture</p>
      </div>

      {/* Feed (Scrollable Area) */}
      <ScrollArea ref={scrollRef} className="flex-1 w-full">
        {doubts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center px-4">
            <p className="text-[#e7e9ea] font-bold text-lg">No doubts yet</p>
            <p className="text-[#71767b] text-sm mt-1">
              Be the first to ask a question about this topic.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {doubts.map((doubt) => (
              <div 
                key={doubt.id} 
                className="p-3 border-b border-[#2f3336] hover:bg-white/5 transition-colors cursor-default"
              >
                <div className="flex flex-col gap-1">
                  {/* Meta (Timestamp only - Username removed) */}
                  <div className="flex items-center gap-1 text-[#71767b] text-[15px]">
                    <span>· {format(new Date(doubt.askedAt), 'h:mm a')}</span>
                  </div>

                  {/* Question Text */}
                  <div className="text-[15px] leading-6 whitespace-pre-wrap text-[#e7e9ea]">
                    {doubt.question}
                  </div>

                  {/* Status / Answer Section */}
                  {doubt.answer ? (
                    <div className="mt-3 pt-3 border-t border-[#2f3336]">
                      {/* Instructor Reply Header */}
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[15px] font-bold text-[#e7e9ea] flex items-center gap-1">
                          Instructor
                          <CheckCircle2 className="w-4 h-4 text-[#1d9bf0] fill-white" />
                        </span>
                        <span className="text-[#71767b] text-[15px]">
                          · {doubt.answeredAt && format(new Date(doubt.answeredAt), 'h:mm a')}
                        </span>
                      </div>
                      {/* Answer Text */}
                      <div className="text-[15px] leading-6 text-[#e7e9ea]">
                        {doubt.answer}
                      </div>
                    </div>
                  ) : (
                    /* Pending Indicator */
                    <div className="flex items-center gap-[5px] mt-2 text-[#eab308] text-[13px]">
                      <span className="w-1.5 h-1.5 bg-[#eab308] rounded-full animate-pulse" />
                      <span>Awaiting response from instructor</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Composer (Input Area - Moved to Bottom) */}
      <div className="p-4 border-t border-[#2f3336] bg-black">
        <div className="flex flex-col gap-3">
          <Textarea
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What's your doubt?"
            className="w-full bg-transparent border-none text-[#e7e9ea] text-lg resize-none p-0 focus-visible:ring-0 placeholder:text-[#71767b] min-h-[50px]"
            rows={2}
            disabled={isSubmitting}
          />
          
          <div className="flex justify-between items-center border-t border-[#2f3336] pt-3">
             {/* Empty div for spacing if we add icons later */}
            <div className="flex gap-2 text-[#1d9bf0]">
              {/* Icons removed as per "remove image thing" request */}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!newQuestion.trim() || isSubmitting}
              className="bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white rounded-full font-bold px-5 py-2 h-auto text-[15px] transition-colors"
            >
              {isSubmitting ? 'Posting...' : 'Post Doubt'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
