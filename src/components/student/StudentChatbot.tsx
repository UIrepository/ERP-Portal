import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageCircle, 
  X, 
  Send, 
  Loader2, 
  Bot, 
  User, 
  ChevronRight 
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Message {
  id: string;
  content: string;
  sender_type: 'user' | 'admin' | 'bot';
  created_at: string;
  options?: string[]; // For bot choices
  action?: 'batch' | 'subject' | 'issue';
}

// Common Support Options
const ISSUE_TYPES = [
  "Video Playback Issue",
  "Audio Problem",
  "PDF/Notes Not Opening",
  "Live Class Joining Error",
  "App Crash / Bug",
  "Other"
];

export const StudentChatbot = () => {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Triage State
  const [triageStep, setTriageStep] = useState<'batch' | 'subject' | 'issue' | 'chat'>('batch');
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);

  // 1. Fetch User Enrollments (For Batches & Subjects)
  const { data: enrollments } = useQuery({
    queryKey: ['chatbot-enrollments', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      const { data } = await supabase
        .from('user_enrollments')
        .select('batch_name, subject_name')
        .eq('user_id', profile.user_id);
      return data || [];
    },
    enabled: !!profile?.user_id,
  });

  // Derive Batches
  const uniqueBatches = Array.from(new Set(enrollments?.map(e => e.batch_name) || [])).sort();

  // Derive Subjects (Dynamic based on selected batch)
  const availableSubjects = enrollments
    ?.filter(e => e.batch_name === selectedBatch)
    .map(e => e.subject_name)
    .sort() || [];

  // 2. Fetch Chat History (Once Triage is Done)
  const { data: chatHistory, isLoading } = useQuery({
    queryKey: ['student-chat', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      const { data } = await supabase
        .from('support_chats')
        .select('*')
        .eq('user_id', profile.user_id)
        .order('created_at', { ascending: true });
      return data as Message[];
    },
    enabled: !!profile?.user_id && triageStep === 'chat',
  });

  // 3. Mutation to Send Message
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!profile?.user_id) return;
      
      // Construct the initial context if this is the first message after triage
      let finalContent = content;
      if (localMessages.length > 0 && chatHistory?.length === 0) {
         finalContent = `[ISSUE REPORT]\nBatch: ${selectedBatch}\nSubject: ${selectedSubject}\nIssue: ${selectedIssue}\n\nUser Message: ${content}`;
      }

      await supabase.from('support_chats').insert({
        user_id: profile.user_id,
        content: finalContent,
        sender_type: 'user',
        is_read: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-chat'] });
      setNewMessage('');
    },
  });

  // Initialize Triage on Open
  useEffect(() => {
    if (isOpen && localMessages.length === 0 && (!chatHistory || chatHistory.length === 0)) {
       startTriage();
    }
  }, [isOpen, chatHistory]);

  const startTriage = () => {
    setTriageStep('batch');
    setLocalMessages([
      {
        id: 'bot-1',
        content: `Hi ${profile?.full_name?.split(' ')[0] || 'there'}! 👋 I can help you connect with support. First, which batch are you facing an issue with?`,
        sender_type: 'bot',
        created_at: new Date().toISOString(),
        options: uniqueBatches,
        action: 'batch'
      }
    ]);
  };

  const handleOptionSelect = (option: string, action: 'batch' | 'subject' | 'issue') => {
    // Add User Response to Local UI
    const userMsg: Message = {
        id: `user-${Date.now()}`,
        content: option,
        sender_type: 'user',
        created_at: new Date().toISOString()
    };
    
    let nextBotMsg: Message | null = null;

    if (action === 'batch') {
        setSelectedBatch(option);
        setTriageStep('subject');
        
        // Calculate subjects for the selected batch immediately
        const subjects = enrollments
            ?.filter(e => e.batch_name === option)
            .map(e => e.subject_name)
            .sort() || [];

        nextBotMsg = {
            id: `bot-${Date.now()}`,
            content: "Got it. Which subject is this related to?",
            sender_type: 'bot',
            created_at: new Date().toISOString(),
            options: subjects,
            action: 'subject'
        };
    } else if (action === 'subject') {
        setSelectedSubject(option);
        setTriageStep('issue');
        nextBotMsg = {
            id: `bot-${Date.now()}`,
            content: "Okay. What kind of issue are you facing?",
            sender_type: 'bot',
            created_at: new Date().toISOString(),
            options: ISSUE_TYPES,
            action: 'issue'
        };
    } else if (action === 'issue') {
        setSelectedIssue(option);
        setTriageStep('chat');
        nextBotMsg = {
            id: `bot-${Date.now()}`,
            content: "Thanks! Please describe your issue in detail below, and a support agent will get back to you shortly.",
            sender_type: 'bot',
            created_at: new Date().toISOString(),
        };
    }

    setLocalMessages(prev => nextBotMsg ? [...prev, userMsg, nextBotMsg] : [...prev, userMsg]);
  };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage);
  };

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [localMessages, chatHistory, isOpen]);

  // Combine local triage messages with real chat history
  const displayMessages = triageStep === 'chat' && chatHistory && chatHistory.length > 0
    ? chatHistory 
    : localMessages;

  return (
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg transition-all duration-300 z-50",
          isOpen ? "scale-0 opacity-0" : "scale-100 opacity-100 bg-indigo-600 hover:bg-indigo-700"
        )}
      >
        <MessageCircle className="h-7 w-7 text-white" />
      </Button>

      {/* Chat Window */}
      <div
        className={cn(
          "fixed bottom-6 right-6 w-[380px] h-[600px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col transition-all duration-300 z-50 overflow-hidden font-sans",
          isOpen ? "translate-y-0 opacity-100" : "translate-y-[120%] opacity-0 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
             <div className="relative">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                   <Bot className="h-6 w-6 text-white" />
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-indigo-700 rounded-full"></span>
             </div>
             <div>
                <h3 className="font-bold text-base leading-tight">Student Support</h3>
                <p className="text-[11px] text-indigo-100 opacity-90">Usually replies in 10 mins</p>
             </div>
          </div>
          <Button 
             variant="ghost" 
             size="icon" 
             onClick={() => setIsOpen(false)} 
             className="text-white/80 hover:text-white hover:bg-white/10 rounded-full h-8 w-8"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 bg-slate-50 p-4">
          <div className="space-y-4 pb-2">
            
            {/* Loading State */}
            {isLoading && (
               <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
               </div>
            )}

            {/* Messages List */}
            {displayMessages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                  msg.sender_type === 'user' ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                    msg.sender_type === 'user'
                      ? "bg-indigo-600 text-white rounded-tr-none"
                      : "bg-white text-slate-700 border border-slate-200 rounded-tl-none"
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {/* Bot Options (Only for last bot message if options exist) */}
            {displayMessages.length > 0 && 
             displayMessages[displayMessages.length - 1].sender_type === 'bot' && 
             displayMessages[displayMessages.length - 1].options && (
               <div className="flex flex-col gap-2 mt-2 ml-1 max-w-[85%] animate-in fade-in zoom-in duration-300">
                  {displayMessages[displayMessages.length - 1].options!.map((opt) => (
                     <button
                        key={opt}
                        onClick={() => handleOptionSelect(opt, displayMessages[displayMessages.length - 1].action!)}
                        className="w-full text-left px-4 py-3 bg-white border border-indigo-100 text-indigo-700 text-sm font-medium rounded-xl hover:bg-indigo-50 hover:border-indigo-300 transition-all shadow-sm flex items-center justify-between group"
                     >
                        {opt}
                        <ChevronRight className="h-4 w-4 text-indigo-300 group-hover:text-indigo-600 transition-colors" />
                     </button>
                  ))}
               </div>
            )}

            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-100 shrink-0">
          {triageStep === 'chat' ? (
             <div className="flex gap-2 items-end">
               <Input
                 value={newMessage}
                 onChange={(e) => setNewMessage(e.target.value)}
                 placeholder="Type your message..."
                 className="flex-1 bg-slate-50 border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[44px]"
                 autoFocus
               />
               <Button 
                 type="submit" 
                 size="icon" 
                 disabled={sendMessageMutation.isPending || !newMessage.trim()}
                 className="h-11 w-11 rounded-lg bg-indigo-600 hover:bg-indigo-700 shrink-0"
               >
                 {sendMessageMutation.isPending ? (
                   <Loader2 className="h-5 w-5 animate-spin" />
                 ) : (
                   <Send className="h-5 w-5" />
                 )}
               </Button>
             </div>
          ) : (
             <div className="text-center py-2 text-xs text-slate-400 italic bg-slate-50 rounded-lg border border-dashed border-slate-200">
                Please select an option above to continue
             </div>
          )}
        </form>
      </div>
    </>
  );
};
