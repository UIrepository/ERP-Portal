import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useChatDrawer } from '@/hooks/useChatDrawer';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
  GraduationCap
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string | null;
  context?: string | null;
  subject_context?: string | null;
}

export const StudentChatDrawer = () => {
  const { profile } = useAuth();
  const { state, closeDrawer, selectSupportRole, setRecipient, resetToRoleSelection } = useChatDrawer();
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [isLoadingRecipient, setIsLoadingRecipient] = useState(false);

  // Fetch admin for support
  const fetchAdmin = async () => {
    const { data, error } = await supabase
      .from('admins')
      .select('user_id, name')
      .not('user_id', 'is', null)
      .limit(1)
      .maybeSingle();
    
    if (error || !data) {
      toast.error('No admin available at the moment');
      return null;
    }
    return data;
  };

  // Fetch manager for support
  const fetchManager = async (studentBatches: string[]) => {
    const { data, error } = await supabase
      .from('managers')
      .select('user_id, name, assigned_batches')
      .not('user_id', 'is', null)
      .limit(100);
    
    if (error || !data || data.length === 0) {
      toast.error('No manager available at the moment');
      return null;
    }

    // Find manager whose assigned_batches overlaps with student batches
    const matchingManager = data.find(manager => 
      manager.assigned_batches?.some((b: string) => studentBatches.includes(b))
    );

    return matchingManager || data[0]; // Fallback to first manager
  };

  // Fetch teacher for subject connect
  const fetchTeacher = async (batch: string, subject: string) => {
    const { data, error } = await supabase
      .from('teachers')
      .select('user_id, name, assigned_batches, assigned_subjects')
      .not('user_id', 'is', null)
      .limit(100);
    
    if (error || !data || data.length === 0) {
      toast.error('No teacher available for this subject');
      return null;
    }

    // Find teacher matching both batch and subject
    const matchingTeacher = data.find(teacher => 
      teacher.assigned_batches?.includes(batch) && 
      teacher.assigned_subjects?.includes(subject)
    );

    if (!matchingTeacher) {
      toast.error('No teacher assigned to this subject and batch');
      return null;
    }

    return matchingTeacher;
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
        resetToRoleSelection();
      }
    } catch {
      toast.error('Failed to connect to support');
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
          toast.error('Failed to connect to teacher');
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
    onError: () => {
      toast.error('Failed to send message');
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Role Selection View (Support Mode)
  const renderRoleSelection = () => (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-sm text-muted-foreground text-center mb-2">
        Who would you like to contact?
      </p>
      
      <button
        onClick={() => handleRoleSelect('admin')}
        disabled={isLoadingRecipient}
        className="flex items-center gap-4 p-4 rounded-lg border border-slate-200 hover:border-slate-900 transition-colors text-left group"
      >
        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
          <Shield className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 group-hover:text-slate-800">Admin</h3>
          <p className="text-sm text-slate-500">Technical Support</p>
        </div>
      </button>

      <button
        onClick={() => handleRoleSelect('manager')}
        disabled={isLoadingRecipient}
        className="flex items-center gap-4 p-4 rounded-lg border border-slate-200 hover:border-slate-900 transition-colors text-left group"
      >
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <Briefcase className="h-6 w-6 text-emerald-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 group-hover:text-slate-800">Manager</h3>
          <p className="text-sm text-slate-500">Batch Issues</p>
        </div>
      </button>

      {isLoadingRecipient && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Connecting to support...
        </div>
      )}
    </div>
  );

  // Chat View
  const renderChatView = () => (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        {state.mode === 'support' && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={resetToRoleSelection}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary/10 text-primary">
            {state.mode === 'support' ? (
              <User className="h-4 w-4" />
            ) : (
              <GraduationCap className="h-4 w-4" />
            )}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-semibold text-sm">{state.selectedRecipient?.displayName}</h3>
          <p className="text-xs text-muted-foreground">
            {state.mode === 'support' ? 'Support Chat' : 'Subject Mentor'}
          </p>
        </div>
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
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      isMe 
                        ? 'bg-primary text-primary-foreground rounded-br-sm' 
                        : 'bg-muted rounded-bl-sm'
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                    <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
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
      <div className="p-4 border-t shrink-0">
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
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">
        Connecting to {state.subjectContext?.subject} Mentor...
      </p>
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

    if (state.mode === 'support') {
      return renderRoleSelection();
    }

    return renderLoadingRecipient();
  };

  // Get sheet title
  const getSheetTitle = () => {
    if (state.mode === 'subject-connect' && state.subjectContext) {
      return `${state.subjectContext.subject} Support`;
    }
    return 'Support Chat';
  };

  return (
    <Sheet open={state.isOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <SheetTitle className="text-left">{getSheetTitle()}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-hidden">
          {renderContent()}
        </div>
      </SheetContent>
    </Sheet>
  );
};
