/**
 * Doubts Panel Component
 * Chat-style interface for students to ask questions and view instructor replies
 */

import { useState } from 'react';
import { Send, MessageCircle, User, CheckCircle2 } from 'lucide-react';
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

export const DoubtsPanel = ({ doubts, onSubmitDoubt, userName = 'You' }: DoubtsPanelProps) => {
  const [newQuestion, setNewQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-zinc-700">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          Doubts & Questions
        </h3>
        <p className="text-sm text-zinc-400 mt-1">
          Ask questions about this lecture
        </p>
      </div>

      {/* Doubts List */}
      <ScrollArea className="flex-1 p-4">
        {doubts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <MessageCircle className="w-12 h-12 text-zinc-600 mb-4" />
            <p className="text-zinc-400 text-sm">No questions yet</p>
            <p className="text-zinc-500 text-xs mt-1">
              Be the first to ask a doubt!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {doubts.map((doubt) => (
              <div 
                key={doubt.id} 
                className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50"
              >
                {/* Question */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">
                        {doubt.askedBy}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {format(new Date(doubt.askedAt), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300">{doubt.question}</p>
                  </div>
                </div>

                {/* Answer (if exists) */}
                {doubt.answer && (
                  <div className="mt-4 ml-11 pl-4 border-l-2 border-green-500/30">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-medium text-green-400">
                        {doubt.answeredBy || 'Instructor'}
                      </span>
                      {doubt.answeredAt && (
                        <span className="text-xs text-zinc-500">
                          {format(new Date(doubt.answeredAt), 'MMM d, h:mm a')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-300">{doubt.answer}</p>
                  </div>
                )}

                {/* Pending indicator */}
                {!doubt.answer && (
                  <div className="mt-3 ml-11">
                    <span className="text-xs text-amber-500/80 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                      Awaiting response
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t border-zinc-700 bg-zinc-900/50">
        <div className="flex gap-2">
          <Textarea
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your question here..."
            className="flex-1 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 resize-none min-h-[80px]"
            disabled={isSubmitting}
          />
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-zinc-500">
            Press Enter to send, Shift+Enter for new line
          </span>
          <Button
            onClick={handleSubmit}
            disabled={!newQuestion.trim() || isSubmitting}
            size="sm"
            className="gap-2"
          >
            <Send className="w-4 h-4" />
            Ask Doubt
          </Button>
        </div>
      </div>
    </div>
  );
};
