import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useChatDrawer } from '@/hooks/useChatDrawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Shield, 
  Briefcase, 
  Send, 
  Loader2, 
  ArrowLeft,
  User,
  GraduationCap,
  MessageCircle,
  X,
  Bot
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string | null;
  context?: string | null;
  subject_context?: string | null;
}

export const StudentChatbot = () => {
  const { profile } = useAuth();
  const { 
    state, 
    closeDrawer, 
    selectSupportRole, 
    setRecipient, 
    resetToRoleSelection,
    toggleChatbot 
  } = useChatDrawer();
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [isLoadingRecipient, setIsLoadingRecipient] = useState(false);
  const [managerUnavailable, setManagerUnavailable] = useState(false);

  // Pre-fetch available staff
  const { data: availableStaff } = useQuery({
    queryKey: ['available-support-staff', profile?.user_id],
    queryFn: async () => {
      const [admins, managers] = await Promise.all([
        supabase.from('admins').select('user_id').not('user_id', 'is', null),
        supabase.from('managers').select('user_id, assigned_batches').not('user_id', 'is', null)
      ]);
      
      return {
        hasAdmin: (admins.data?.length || 0) > 0,
        hasManager: (managers.data?.length || 0) > 0,
        managers: managers.data || []
      };
    },
    enabled: !!profile?.user_id && state.isOpen,
  });

  // Fetch admin for support
  const fetchAdmin = async () => {
    const { data, error } = await supabase
      .from('admins')
      .select('user_id, name')
      .not('user_id', 'is', null)
      .limit(1)
      .maybeSingle();
    
    if (error || !data) {
      return null;
    }
    return data;
  };

  // Fetch manager for support with better fallback
  const fetchManager = async (studentBatches: string[]) => {
    const { data, error } = await supabase
      .from('managers')
      .select('user_id, name, assigned_batches')
      .not('user_id', 'is', null);
    
    if (error || !data || data.length === 0) {
      return null;
    }

    // Find manager whose assigned_batches overlaps with student batches
    const matchingManager = data.find(manager => 
      manager.assigned_batches?.some((b: string) => studentBatches.includes(b))
    );

    // Return matching manager or first available
    return matchingManager || data[0];
  };

  // Fetch teacher for subject connect
  const fetchTeacher = async (batch: string, subject: string) => {
    const { data, error } = await supabase
      .from('teachers')
      .select('user_id, name, assigned_batches, assigned_subjects')
      .not('user_id', 'is', null);
    
    if (error || !data || data.length === 0) {
      return null;
    }

    // Find teacher matching both batch and subject
    const matchingTeacher = data.find(teacher => 
      teacher.assigned_batches?.includes(batch) && 
      teacher.assigned_subjects?.includes(subject)
    );

    return matchingTeacher || null;
  };

  // Fetch student batches for manager lookup
  const { data: studentBatches } = useQuery({
    queryKey: ['studentBatches', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      const { data } = await supabase
        .from('user_enrollments')
        .select('batch_name')
        .eq('user_id', profile.user_id);
      return [...new Set(data?.map(e => e.batch_name) || [])];
    },
    enabled: !!profile?.user_id && state.isOpen,
  });

  // Handle role selection for support mode
  const handleRoleSelect = async (role: 'admin' | 'manager') => {
    setManagerUnavailable(false);
    selectSupportRole(role);
    setIsLoadingRecipient(true);

    try {
      let staffMember: { user_id: string | null; name: string } | null = null;

      if (role === 'admin') {
        staffMember = await fetchAdmin();
      } else {
        staffMember = await fetchManager(studentBatches || []);
      }

      if (staffMember && staffMember.user_id) {
        setRecipient({
          id: staffMember.user_id,
          name: staffMember.name,
          displayName: 'Support Agent',
        });
      } else {
        if (role === 'manager') {
          setManagerUnavailable(true);
        }
        resetToRoleSelection();
      }
    } catch {
      resetToRoleSelection();
    } finally {
      setIsLoadingRecipient(false);
    }
  };

  // Auto-fetch teacher when subject-connect mode opens
  useEffect(() => {
    if (state.mode === 'subject-connect' && state.subjectContext && state.isOpen && !state.selectedRecipient) {
      const fetchTeacherForSubject = async () => {
        setIsLoadingRecipient(true);
        try {
          const teacher = await fetchTeacher(
            state.subjectContext!.batch, 
            state.subjectContext!.subject
          );
          if (teacher && teacher.user_id) {
            setRecipient({
              id: teacher.user_id,
              name: teacher.name,
              displayName: `${state.subjectContext!.subject} Mentor`,
            });
          }
        } catch {
          // Silent fail - UI will handle
        } finally {
          setIsLoadingRecipient(false);
        }
      };
      fetchTeacherForSubject();
    }
  }, [state.mode, state.subjectContext, state.isOpen, state.selectedRecipient, setRecipient]);

  // Fetch messages
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ['chat-messages', profile?.user_id, state.selectedRecipient?.id],
    queryFn: async () => {
      if (!profile?.user_id || !state.selectedRecipient?.id) return [];
      
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${profile.user_id},receiver_id.eq.${state.selectedRecipient.id}),and(sender_id.eq.${state.selectedRecipient.id},receiver_id.eq.${profile.user_id})`)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!profile?.user_id && !!state.selectedRecipient?.id,
    refetchInterval: 3000,
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!message.trim() || !state.selectedRecipient?.id || !profile?.user_id) return;
      
      // Determine context based on mode
      let context = 'general';
      let subjectContext: string | null = null;

      if (state.mode === 'support') {
        context = state.supportRole === 'admin' ? 'support_admin' : 'support_manager';
      } else if (state.mode === 'subject-connect' && state.subjectContext) {
        context = 'subject_doubt';
        subjectContext = state.subjectContext.subject;
      }

      const { error } = await supabase.from('direct_messages').insert({
        sender_id: profile.user_id,
        receiver_id: state.selectedRecipient.id,
        content: message.trim(),
        context,
        subject_context: subjectContext,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Reset manager unavailable state when drawer closes
  useEffect(() => {
    if (!state.isOpen) {
      setManagerUnavailable(false);
    }
  }, [state.isOpen]);

  // Welcome View with options
  const renderWelcomeView = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <img src="/imagelogo.png" alt="Logo" className="h-6 w-auto" />
          <span className="font-semibold text-sm text-slate-800">Unknown IITians</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeDrawer}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Bot greeting */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="flex items-start gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
            <p className="text-sm text-slate-700">
              Hi! 👋 I'm here to help. Who would you like to connect with?
            </p>
          </div>
        </div>

        {/* Manager unavailable fallback */}
        {managerUnavailable && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-amber-800">
              No manager is currently assigned to your batch. Would you like to talk to an Admin instead?
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={() => handleRoleSelect('admin')}>
                Talk to Admin
              </Button>
              <Button size="sm" variant="outline" onClick={() => setManagerUnavailable(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Option blocks */}
        <div className="space-y-3">
          {/* Admin option */}
          <button
            onClick={() => handleRoleSelect('admin')}
            disabled={isLoadingRecipient || !availableStaff?.hasAdmin}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left group",
              availableStaff?.hasAdmin 
                ? "border-slate-200 hover:border-slate-400 hover:shadow-sm" 
                : "border-slate-100 opacity-50 cursor-not-allowed"
            )}
          >
            <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 text-[15px]">Talk to Admin</h3>
              <p className="text-sm text-slate-500">Technical Support</p>
            </div>
          </button>

          {/* Manager option */}
          <button
            onClick={() => handleRoleSelect('manager')}
            disabled={isLoadingRecipient || !availableStaff?.hasManager}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left group",
              availableStaff?.hasManager 
                ? "border-slate-200 hover:border-slate-400 hover:shadow-sm" 
                : "border-slate-100 opacity-50 cursor-not-allowed"
            )}
          >
            <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <Briefcase className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 text-[15px]">Talk to Manager</h3>
              <p className="text-sm text-slate-500">Batch Issues</p>
            </div>
          </button>

          {/* Teacher option - only in subject-connect mode */}
          {state.mode === 'subject-connect' && state.subjectContext && (
            <button
              onClick={() => {/* Already triggers auto-fetch */}}
              disabled={isLoadingRecipient}
              className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-slate-400 hover:shadow-sm transition-all text-left group"
            >
              <div className="w-11 h-11 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                <GraduationCap className="h-5 w-5 text-violet-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 text-[15px]">Talk to Teacher</h3>
                <p className="text-sm text-slate-500">{state.subjectContext.subject} Mentor</p>
              </div>
            </button>
          )}
        </div>

        {isLoadingRecipient && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            Connecting...
          </div>
        )}
      </div>
    </div>
  );

  // Chat View
  const renderChatView = () => (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0 bg-white">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8"
          onClick={resetToRoleSelection}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary/10 text-primary">
            {state.mode === 'support' ? (
              <User className="h-4 w-4" />
            ) : (
              <GraduationCap className="h-4 w-4" />
            )}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="font-semibold text-sm">{state.selectedRecipient?.displayName}</h3>
          <p className="text-xs text-muted-foreground">
            {state.mode === 'support' ? 'Support Chat' : 'Subject Mentor'}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeDrawer}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        {loadingMessages ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages?.length === 0 ? (
          <div className="text-center text-muted-foreground mt-10">
            <p className="text-sm">Start a conversation with {state.selectedRecipient?.displayName}!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages?.map((msg) => {
              const isMe = msg.sender_id === profile?.user_id;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div 
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2",
                      isMe 
                        ? "bg-primary text-primary-foreground rounded-br-sm" 
                        : "bg-slate-100 rounded-bl-sm"
                    )}
                  >
                    <p className="text-sm">{msg.content}</p>
                    <p className={cn(
                      "text-[10px] mt-1 text-right",
                      isMe ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      {msg.created_at ? format(new Date(msg.created_at), 'h:mm a') : ''}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>

      {/* Message Input */}
      <div className="p-3 border-t shrink-0 bg-white">
        <div className="flex gap-2">
          <Input 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage.mutate()}
            className="flex-1"
          />
          <Button 
            onClick={() => sendMessage.mutate()} 
            disabled={!message.trim() || sendMessage.isPending}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  // Loading state for subject-connect
  const renderLoadingRecipient = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <img src="/imagelogo.png" alt="Logo" className="h-6 w-auto" />
          <span className="font-semibold text-sm text-slate-800">Unknown IITians</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeDrawer}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Connecting to {state.subjectContext?.subject} Mentor...
        </p>
      </div>
    </div>
  );

  // Determine which view to render
  const renderContent = () => {
    if (isLoadingRecipient && state.mode === 'subject-connect') {
      return renderLoadingRecipient();
    }

    if (state.selectedRecipient) {
      return renderChatView();
    }

    return renderWelcomeView();
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={toggleChatbot}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg transition-all duration-200",
          "bg-slate-900 hover:bg-slate-800 hover:scale-105 hover:shadow-xl",
          "flex items-center justify-center",
          state.isOpen && "rotate-0"
        )}
      >
        {state.isOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <MessageCircle className="h-6 w-6 text-white" />
        )}
      </button>

      {/* Chatbot Window */}
      {state.isOpen && (
        <div 
          className={cn(
            "fixed bottom-24 right-6 z-50 w-[380px] h-[500px]",
            "bg-white border border-slate-200 rounded-2xl shadow-2xl",
            "flex flex-col overflow-hidden",
            "animate-in fade-in slide-in-from-bottom-4 duration-200"
          )}
        >
          {renderContent()}
        </div>
      )}
    </>
  );
};
