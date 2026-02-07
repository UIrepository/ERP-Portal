import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useChatDrawer } from '@/hooks/useChatDrawer';
import { Loader2, Send, X, MessageSquare, Minus, ChevronLeft } from 'lucide-react';
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

  // Custom styles from design
  const bubbleMeClass = "rounded-[12px_12px_2px_12px]";
  const bubbleThemClass = "rounded-[12px_12px_12px_2px]";
  const premiumShadowClass = "shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]";
  const chatWindowShadowClass = "shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.05)]";

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
          displayName: role === 'admin' ? 'Support Admin' : 'Academic Manager',
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

  // Welcome View
  const renderWelcomeView = () => (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-slate-900 rounded flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-[10px]">UK</span>
          </div>
          <span className="font-bold text-slate-800 text-sm tracking-tight">Support Center</span>
        </div>
        <button onClick={closeDrawer} className="text-slate-400 hover:text-slate-600 transition-colors">
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* Welcome Content */}
      <div className="flex-1 p-6 space-y-8 overflow-y-auto no-scrollbar">
        <div className="space-y-2 animate-in slide-in-from-bottom-2 fade-in duration-500">
          <h1 className="text-xl font-bold text-slate-900">Hello there.</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            How can we help you today? Please select a department to start a conversation.
          </p>
        </div>

        {managerUnavailable && (
           <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 animate-in fade-in">
             Manager currently unavailable. Try Admin support.
           </div>
        )}

        {/* Grid Options */}
        <div className="grid grid-cols-2 gap-3">
          {/* Admin Option */}
          <button 
            onClick={() => handleRoleSelect('admin')}
            disabled={isLoadingRecipient || !availableStaff?.hasAdmin}
            className={cn(
              "flex flex-col items-center justify-center p-4 rounded-md border border-slate-200 bg-white transition-all text-center group",
              premiumShadowClass,
              availableStaff?.hasAdmin 
                ? "hover:border-slate-400 hover:bg-slate-50 cursor-pointer" 
                : "opacity-60 cursor-not-allowed grayscale"
            )}
          >
            <span className="text-[13px] font-semibold text-slate-800">Admin</span>
            <span className="text-[10px] text-slate-400 uppercase mt-1 tracking-wider">Tech Support</span>
          </button>

          {/* Manager Option */}
          <button 
            onClick={() => handleRoleSelect('manager')}
            disabled={isLoadingRecipient || !availableStaff?.hasManager}
            className={cn(
              "flex flex-col items-center justify-center p-4 rounded-md border border-slate-200 bg-white transition-all text-center group",
              premiumShadowClass,
              availableStaff?.hasManager 
                ? "hover:border-slate-400 hover:bg-slate-50 cursor-pointer" 
                : "opacity-60 cursor-not-allowed grayscale"
            )}
          >
            <span className="text-[13px] font-semibold text-slate-800">Manager</span>
            <span className="text-[10px] text-slate-400 uppercase mt-1 tracking-wider">Academics</span>
          </button>

          {/* Mentor Option - Only visible if active */}
          {state.mode === 'subject-connect' && state.subjectContext && (
            <button 
              onClick={() => {/* Triggered by effect mostly, but good for UX */}}
              disabled={isLoadingRecipient}
              className={cn(
                "flex flex-col items-center justify-center p-4 rounded-md border border-slate-200 bg-white transition-all text-center group col-span-2",
                premiumShadowClass,
                "hover:border-slate-400 hover:bg-slate-50 cursor-pointer"
              )}
            >
              <span className="text-[13px] font-semibold text-slate-800">Mentor</span>
              <span className="text-[10px] text-slate-400 uppercase mt-1 tracking-wider">
                {state.subjectContext.subject} Doubt Solving
              </span>
            </button>
          )}

          {isLoadingRecipient && (
             <div className="col-span-2 flex items-center justify-center py-4 text-xs text-slate-400 gap-2">
               <Loader2 className="h-3 w-3 animate-spin" /> Connecting...
             </div>
          )}
        </div>
      </div>

      {/* Footer Logo */}
      <div className="p-4 flex justify-center border-t border-slate-100 bg-white/50">
         <div className="flex items-center gap-1 opacity-40 grayscale">
            <img src="https://res.cloudinary.com/dkywjijpv/image/upload/v1769193106/UI_Logo_yiput4.png" alt="UI" className="h-4 w-auto" />
            <span className="text-[10px] font-bold text-slate-600">Unknown IITians</span>
         </div>
      </div>
    </div>
  );

  // Chat View
  const renderChatView = () => (
    <div className="flex flex-col h-full bg-white">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 bg-white z-10 shadow-sm">
        <button 
          onClick={resetToRoleSelection}
          className="p-1.5 hover:bg-slate-100 rounded transition-colors text-slate-500"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h3 className="font-bold text-slate-900 text-sm">
            {state.selectedRecipient?.displayName || 'Support'}
          </h3>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">Online</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style>{`
          div::-webkit-scrollbar { display: none; }
        `}</style>
        
        {loadingMessages ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        ) : messages?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-60">
             <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-slate-400" />
             </div>
             <p className="text-sm text-slate-500">Start a conversation</p>
          </div>
        ) : (
          messages?.map((msg) => {
            const isMe = msg.sender_id === profile?.user_id;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                <div 
                  className={cn(
                    "p-3 text-sm shadow-sm max-w-[85%]",
                    isMe 
                      ? `bg-slate-900 text-white ${bubbleMeClass}`
                      : `bg-white border border-slate-200 text-slate-700 ${bubbleThemClass}`
                  )}
                >
                  {msg.content}
                  <div className={cn(
                    "text-[9px] mt-1 text-right opacity-60",
                    isMe ? "text-slate-300" : "text-slate-400"
                  )}>
                    {msg.created_at ? format(new Date(msg.created_at), 'h:mm a') : ''}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-100">
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200 focus-within:border-slate-400 transition-all">
          <input 
            type="text" 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage.mutate()}
            placeholder="Type a message..." 
            className="flex-1 bg-transparent border-none px-2 py-1.5 text-sm outline-none text-slate-800 placeholder:text-slate-400"
          />
          <button 
            onClick={() => sendMessage.mutate()}
            disabled={!message.trim() || sendMessage.isPending}
            className="p-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendMessage.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );

  // Loading state for subject-connect auto-connect
  const renderLoadingView = () => (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
        <span className="font-bold text-slate-800 text-sm">Connecting...</span>
        <button onClick={closeDrawer}><X className="w-4 h-4 text-slate-400" /></button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
        <p className="text-sm text-slate-500">Finding your mentor...</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={toggleChatbot}
        className={cn(
          "fixed bottom-6 right-6 w-14 h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95 z-50",
          state.isOpen ? "rotate-0" : ""
        )}
      >
        {state.isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageSquare className="w-6 h-6" />
        )}
      </button>

      {/* Chat Window */}
      {state.isOpen && (
        <div 
          className={cn(
            "fixed bottom-24 right-6 w-[380px] h-[520px] bg-white rounded-xl flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-4 duration-300 ease-out",
            chatWindowShadowClass
          )}
        >
          {isLoadingRecipient && state.mode === 'subject-connect' 
            ? renderLoadingView() 
            : state.selectedRecipient 
              ? renderChatView() 
              : renderWelcomeView()
          }
        </div>
      )}
    </>
  );
};
