import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useChatDrawer } from '@/hooks/useChatDrawer';
import { Loader2, Send, X, MessageSquare, Minus, ChevronLeft } from 'lucide-react';
import { HugeiconsIcon } from '@hugeicons/react';
import { BubbleChatIcon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { SUPPORT_TREE } from '@/lib/supportTree';
import { ChevronRight, Plus } from 'lucide-react';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription 
} from '@/components/ui/drawer';

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
    openSubjectConnect,
    toggleChatbot
  } = useChatDrawer();
  const [message, setMessage] = useState('');
  // Guided self-help runs INSIDE the chat as a conversation: the bot asks, the
  // student taps quick-reply options, each pick echoes as their own message, the
  // bot "types" (three dots) then replies. Human handoff only appears at the end.
  const [chatMsgs, setChatMsgs] = useState<{ id: number; from: 'bot' | 'user'; text: string; href?: { label: string; url: string } }[]>([]);
  const [chatOpts, setChatOpts] = useState<{ label: string; onSelect: () => void; filled?: boolean }[]>([]);
  const [botTyping, setBotTyping] = useState(false);
  const chatIdRef = useRef(0);
  // The batch the student's issue is about (asked up front when they have >1).
  const [supBatch, setSupBatch] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const guidedEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [isLoadingRecipient, setIsLoadingRecipient] = useState(false);
  const [managerUnavailable, setManagerUnavailable] = useState(false);
  const isMobile = useIsMobile();

  // Custom styles from design
  const bubbleMeClass = "rounded-[8px_8px_2px_8px]";
  const bubbleThemClass = "rounded-[8px_8px_8px_2px]";
  const premiumShadowClass = "shadow-[0_1px_3px_0_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)]";
  const chatWindowShadowClass = "shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.05)]";

  // Student's batches — needed by the staff lookups below, so it must be
  // declared first and included in the availableStaff key/gate.
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

  // Pre-fetch available staff using security definer function. Keyed on
  // studentBatches and gated until it resolves, so the Manager button isn't
  // permanently disabled by an early call with an empty batch list.
  const { data: availableStaff } = useQuery({
    queryKey: ['available-support-staff', profile?.user_id, studentBatches],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_available_support_staff', {
        p_student_batches: studentBatches || []
      });
      if (error || !data || data.length === 0) {
        return { hasAdmin: false, hasManager: false };
      }
      return {
        hasAdmin: data[0].has_admin,
        hasManager: data[0].has_manager,
      };
    },
    enabled: !!profile?.user_id && state.isOpen && studentBatches !== undefined,
  });

  // Enrolled (batch, subject) pairs — the "Subject doubt" branch uses these to
  // connect the student to that subject's teacher (reuses the subject-connect flow).
  const { data: enrolledPairs = [] } = useQuery({
    queryKey: ['support-enrolled-pairs', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      const { data } = await supabase
        .from('user_enrollments')
        .select('batch_name, subject_name')
        .eq('user_id', profile.user_id);
      return (data as { batch_name: string; subject_name: string }[]) || [];
    },
    enabled: !!profile?.user_id && state.isOpen,
  });
  const enrolledSubjects = useMemo(() => {
    const map = new Map<string, string>(); // subject -> a batch that has it
    for (const e of enrolledPairs) if (e.subject_name && !map.has(e.subject_name)) map.set(e.subject_name, e.batch_name);
    return Array.from(map, ([subject, batch]) => ({ subject, batch }));
  }, [enrolledPairs]);

  // Fetch admin for support using RPC
  const fetchAdmin = async () => {
    const { data, error } = await supabase.rpc('get_admin_for_support');
    if (error || !data || data.length === 0) return null;
    return data[0];
  };

  // Fetch manager for support using RPC
  const fetchManager = async (batches: string[]) => {
    // Try each batch to find a manager
    for (const batch of batches) {
      const { data, error } = await supabase.rpc('get_manager_for_batch', { p_batch: batch });
      if (!error && data && data.length > 0) {
        return data[0];
      }
    }
    return null;
  };

  // Fetch teacher for subject connect using RPC
  const fetchTeacher = async (batch: string, subject: string) => {
    const { data, error } = await supabase.rpc('get_teacher_for_subject', { 
      p_batch: batch, 
      p_subject: subject 
    });
    if (error || !data || data.length === 0) {
      return null;
    }
    return data[0];
  };

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
        staffMember = await fetchManager(supBatch ? [supBatch] : (studentBatches || []));
      }

      if (staffMember && staffMember.user_id) {
        setRecipient({
          id: staffMember.user_id,
          name: staffMember.name,
          displayName: role === 'admin' ? 'Support Admin' : 'Academic Manager',
        });
      } else if (role === 'manager') {
        // No manager for this student's batch (or the user isn't enrolled in any
        // batch) — fall back to Admin so support is never a dead end.
        const admin = await fetchAdmin();
        if (admin && admin.user_id) {
          selectSupportRole('admin');
          setRecipient({ id: admin.user_id, name: admin.name, displayName: 'Support Admin' });
        } else {
          setManagerUnavailable(true);
          resetToRoleSelection();
        }
      } else {
        resetToRoleSelection();
      }
    } catch {
      resetToRoleSelection();
    } finally {
      setIsLoadingRecipient(false);
    }
  };

  // ----- Guided self-help conversation engine -----
  const nid = () => (chatIdRef.current += 1);
  const addUser = (text: string) => setChatMsgs((m) => [...m, { id: nid(), from: 'user', text }]);
  // Bot "types" for a beat (three dots), then drops its message(s) + next options.
  const botSay = (
    items: { text: string; href?: { label: string; url: string } }[],
    opts: { label: string; onSelect: () => void; filled?: boolean }[] = [],
  ) => {
    setChatOpts([]);
    setBotTyping(true);
    window.setTimeout(() => {
      setBotTyping(false);
      setChatMsgs((m) => [...m, ...items.map((it) => ({ id: nid(), from: 'bot' as const, text: it.text, href: it.href }))]);
      setChatOpts(opts);
    }, 700);
  };
  const categoryOptions = () => SUPPORT_TREE.map((c) => ({ label: c.label, onSelect: () => chooseCategory(c.id) }));
  const greetTopics = (lead = 'Hi 👋 ') => botSay([{ text: `${lead}What do you need help with? Pick a topic below.` }], categoryOptions());
  const startSupportChat = () => {
    chatIdRef.current = 0;
    setChatMsgs([]);
    const batches = studentBatches || [];
    // Ask which batch first only when the student is in more than one. One batch
    // is auto-selected silently; no enrolment → skip the question entirely.
    if (batches.length > 1 && !supBatch) {
      botSay([{ text: 'Hi 👋 Which batch do you need help with?' }], batches.map((b) => ({ label: b, onSelect: () => chooseBatch(b) })));
    } else {
      if (batches.length === 1 && !supBatch) setSupBatch(batches[0]);
      greetTopics();
    }
  };
  const chooseBatch = (b: string) => {
    addUser(b);
    setSupBatch(b);
    greetTopics('Thanks! ');
  };
  const chooseCategory = (catId: string) => {
    const c = SUPPORT_TREE.find((x) => x.id === catId);
    if (!c) return;
    addUser(c.label);
    botSay([{ text: 'Got it 👍 Which of these is closest?' }], c.leaves.map((l) => ({ label: l.q, onSelect: () => chooseLeaf(catId, l.id) })));
  };
  const chooseLeaf = (catId: string, leafId: string) => {
    const l = SUPPORT_TREE.find((x) => x.id === catId)?.leaves.find((x) => x.id === leafId);
    if (!l) return;
    addUser(l.q);
    // Subject doubt → ask which subject (scoped to the chosen batch), then connect.
    if (l.route === 'teacher') {
      const subs = enrolledSubjects.filter((s) => !supBatch || s.batch === supBatch);
      if (subs.length === 0) {
        botSay([{ text: "You don't have any enrolled subjects yet, so let me connect you to our support team." }],
          [{ label: 'Connect me to support', onSelect: () => handoff('admin') }]);
        return;
      }
      botSay([{ text: 'Sure! Which subject is your doubt about?' }],
        subs.map((s) => ({ label: s.subject, onSelect: () => pickSubject(s.batch, s.subject) })));
      return;
    }
    // Normal answer, then ask if it solved it. Human handoff only appears on "No".
    botSay(
      [{ text: 'Thanks for telling me — here’s what should help 👇' }, { text: l.a, href: l.href }, { text: 'Did this solve it?' }],
      [
        { label: '✅ Yes, thanks!', onSelect: () => { addUser('Yes, that solved it'); botSay([{ text: 'Awesome — glad that helped! 🎉' }], [{ label: 'I have another issue', onSelect: () => greetTopics('Sure — '), filled: true }]); } },
        { label: '🙋 No, I still need help', onSelect: () => { addUser('No, I still need help'); handoff(l.route === 'manager' ? 'manager' : 'admin'); } },
      ],
    );
  };
  const pickSubject = (batch: string, subject: string) => {
    addUser(subject);
    botSay([{ text: `Connecting you to your ${subject} teacher…` }], []);
    openSubjectConnect(batch, subject); // reuses the existing teacher / subject_doubt flow
  };
  // Human handoff — only reached at the END, once self-help didn't resolve it.
  const handoff = (route: 'admin' | 'manager') => {
    addUser('Yes please, connect me');
    botSay([{ text: 'No problem — connecting you to the right person now…' }], []);
    handleRoleSelect(route);
  };
  // Start a fresh conversation for a NEW issue — works from anywhere, including
  // while connected to a person. Disconnects and re-shows the topic options.
  const startNewIssue = () => {
    resetToRoleSelection(); // drop any human recipient
    setChatMsgs([]);        // clear the thread → the effect re-greets with topics
    setChatOpts([]);
    setBotTyping(false);
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

  // Fetch messages — for support mode, fetch by context so student sees replies from ANY staff
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ['chat-messages', profile?.user_id, state.selectedRecipient?.id, state.supportRole, state.mode],
    queryFn: async () => {
      if (!profile?.user_id || !state.selectedRecipient?.id) return [];
      
      // For support conversations, fetch all messages with matching context involving this student
      // This way the student sees replies from any admin/manager, not just the initially assigned one
      if (state.mode === 'support' && state.supportRole) {
        const ctx = state.supportRole === 'admin' ? 'support_admin' : 'support_manager';
        // Latest 120 only (was the whole thread, unbounded, every poll).
        const { data, error } = await supabase
          .from('direct_messages')
          .select('*')
          .eq('context', ctx)
          .or(`sender_id.eq.${profile.user_id},receiver_id.eq.${profile.user_id}`)
          .order('created_at', { ascending: false })
          .limit(120);
        if (error) throw error;
        return ((data as Message[]) || []).reverse();
      }

      // For subject-connect / other modes, keep 1:1 logic
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${profile.user_id},receiver_id.eq.${state.selectedRecipient.id}),and(sender_id.eq.${state.selectedRecipient.id},receiver_id.eq.${profile.user_id})`)
        .order('created_at', { ascending: false })
        .limit(80);

      if (error) throw error;
      return ((data as Message[]) || []).reverse();
    },
    enabled: !!profile?.user_id && !!state.selectedRecipient?.id,
    refetchInterval: 90000, // was 3s, then 45s — thread is bounded now; 90s keeps support snappy
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

  // Unread support replies (from admin/manager) — badges the floating button.
  const { data: supportUnread = 0 } = useQuery({
    queryKey: ['support-unread', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return 0;
      const { count } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', profile.user_id)
        .eq('is_read', false)
        .in('context', ['support_admin', 'support_manager']);
      return count ?? 0;
    },
    enabled: !!profile?.user_id,
    refetchInterval: 60000, // badge only — keep the poll light (was 15s)
  });

  // Once the student opens a support thread, mark those replies read so the
  // badge (and the header bell) clears.
  useEffect(() => {
    if (!profile?.user_id || !state.isOpen || state.mode !== 'support' || !state.supportRole) return;
    const ctx = state.supportRole === 'admin' ? 'support_admin' : 'support_manager';
    (async () => {
      await supabase
        .from('direct_messages')
        .update({ is_read: true })
        .eq('receiver_id', profile.user_id)
        .eq('context', ctx)
        .eq('is_read', false);
      queryClient.invalidateQueries({ queryKey: ['support-unread'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-standard'] });
    })();
  }, [state.isOpen, state.mode, state.supportRole, messages, profile?.user_id, queryClient]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Minimizing keeps the conversation — DON'T clear it, so reopening resumes
  // exactly where the student left off. Only drop the transient "manager
  // unavailable" flag.
  useEffect(() => {
    if (!state.isOpen) setManagerUnavailable(false);
  }, [state.isOpen]);

  // Greet only when the thread is empty (first ever open, or after "Start a new
  // issue"). Waits for the batch list so the batch question can appear. Because
  // the transcript persists, reopening a minimized chat does NOT restart it.
  useEffect(() => {
    if (state.isOpen && state.mode === 'support' && !state.selectedRecipient && studentBatches !== undefined && chatMsgs.length === 0 && !botTyping) {
      startSupportChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isOpen, state.mode, state.selectedRecipient, studentBatches, chatMsgs.length, botTyping]);

  // Auto-scroll the guided chat as it grows / while the bot is typing / when a
  // connected human replies (all in the same thread).
  useEffect(() => {
    guidedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMsgs, botTyping, chatOpts, messages]);

  // Handle Back Button Logic (from the human chat view)
  const handleBack = () => {
    if (state.mode === 'subject-connect') {
      closeDrawer();
    } else {
      // Restart the guided conversation instead of a dead-end.
      setChatMsgs([]);
      setChatOpts([]);
      resetToRoleSelection();
    }
  };

  // Welcome View
  const renderWelcomeView = () => (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-2.5">
          <img 
            src="https://res.cloudinary.com/dkywjijpv/image/upload/v1769193106/UI_Logo_yiput4.png" 
            alt="Logo" 
            className="h-7 w-auto object-contain" 
          />
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
         <div className="flex items-center gap-2 opacity-50 grayscale hover:grayscale-0 transition-all duration-300">
            <img 
              src="https://res.cloudinary.com/dkywjijpv/image/upload/v1769193106/UI_Logo_yiput4.png" 
              alt="UI" 
              className="h-5 w-auto" 
            />
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
          onClick={handleBack}
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

  // Support mode: ONE continuous chat. Guided self-help bubbles first; once it
  // escalates, the live human conversation continues in the SAME thread with a
  // text input (no separate screen).
  const renderGuidedSupport = () => {
    const connected = !!state.selectedRecipient;
    return (
    <div className="flex flex-col h-full bg-white">
      {/* Header (same chat interface throughout) */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white z-10 shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="https://res.cloudinary.com/dkywjijpv/image/upload/v1769193106/UI_Logo_yiput4.png" alt="Logo" className="h-7 w-auto object-contain shrink-0" />
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 text-sm leading-tight truncate">{connected ? state.selectedRecipient!.displayName : 'Support Assistant'}</h3>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">Online</span>
            </div>
          </div>
        </div>
        <button onClick={closeDrawer} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* Conversation — guided bubbles, then (once connected) the live human thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
        {chatMsgs.map((m) => (
          <div key={m.id} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
            <div className={cn(
              'px-3.5 py-2.5 text-sm shadow-sm max-w-[85%]',
              m.from === 'user' ? `bg-slate-900 text-white ${bubbleMeClass}` : `bg-white border border-slate-200 text-slate-700 ${bubbleThemClass}`,
            )}>
              <span className="whitespace-pre-wrap leading-relaxed">{m.text}</span>
              {m.href && (
                <a href={m.href.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 flex items-center gap-1 text-[13px] font-semibold text-indigo-600 hover:underline">
                  {m.href.label} <ChevronRight className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        ))}

        {botTyping && (
          <div className="flex justify-start animate-in fade-in duration-200">
            <div className={`px-4 py-3 bg-white border border-slate-200 ${bubbleThemClass} shadow-sm`}>
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '-0.25s' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '-0.12s' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
              </span>
            </div>
          </div>
        )}

        {/* Inline options — plain rows in a card; "filled" ones as solid buttons */}
        {!connected && chatOpts.length > 0 && !botTyping && (
          <div className="flex flex-col items-start gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200">
            {chatOpts.some((o) => !o.filled) && (
              <div className="max-w-[88%] rounded-md bg-white border border-slate-200 shadow-sm overflow-hidden">
                {chatOpts.filter((o) => !o.filled).map((o, idx) => (
                  <button
                    key={idx}
                    onClick={o.onSelect}
                    className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-indigo-700 hover:bg-indigo-50/70 transition-colors border-t border-slate-100 first:border-t-0"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
            {chatOpts.filter((o) => o.filled).map((o, idx) => (
              <button
                key={`f${idx}`}
                onClick={o.onSelect}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-violet-600 text-white text-[13px] font-semibold shadow-sm hover:bg-violet-700 active:scale-[0.98] transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> {o.label}
              </button>
            ))}
          </div>
        )}

        {/* Live human thread — continues in the same chat once connected */}
        {connected && (
          <>
            <div className="flex justify-center my-1">
              <span className="text-[10px] text-slate-500 bg-slate-100 rounded-full px-2.5 py-0.5">Connected to {state.selectedRecipient!.displayName}</span>
            </div>
            {loadingMessages ? (
              <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
            ) : (
              messages?.map((msg) => {
                const isMe = msg.sender_id === profile?.user_id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                    <div className={cn('px-3.5 py-2.5 text-sm shadow-sm max-w-[85%]', isMe ? `bg-slate-900 text-white ${bubbleMeClass}` : `bg-white border border-slate-200 text-slate-700 ${bubbleThemClass}`)}>
                      <span className="whitespace-pre-wrap leading-relaxed">{msg.content}</span>
                      <div className={cn('text-[9px] mt-1 text-right opacity-60', isMe ? 'text-slate-300' : 'text-slate-400')}>
                        {msg.created_at ? format(new Date(msg.created_at), 'h:mm a') : ''}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
        <div ref={guidedEndRef} />
      </div>

      {/* Text input appears ONLY once connected to a person. During self-help
          it's options-only, so typing can't bypass the guided flow. */}
      {connected && (
        <div className="p-3 bg-white border-t border-slate-100">
          <div className="flex justify-center pb-2">
            <button onClick={startNewIssue} className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
              <Plus className="w-3 h-3" /> Start a new issue
            </button>
          </div>
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200 focus-within:border-slate-400 transition-all">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage.mutate()}
              placeholder="Type your message…"
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
      )}
    </div>
    );
  };

  // Render logic based on content
  const renderContent = () => {
    // Subject-connect (opened from a subject page) keeps its own flow.
    if (state.mode === 'subject-connect') {
      if (isLoadingRecipient) return renderLoadingView();
      if (state.selectedRecipient) return renderChatView();
      return renderWelcomeView();
    }
    // Support mode → ONE continuous chat: guided self-help, and if it escalates,
    // the human conversation continues in the SAME thread (not a separate view).
    return renderGuidedSupport();
  };

  return (
    <>
      {/* Floating Action Button - Always visible to trigger/toggle */}
      <button
        onClick={toggleChatbot}
        className={cn(
          // Sits above the mobile bottom-nav (incl. the iOS safe-area); drops to
          // the corner on desktop where there is no bottom bar.
          "fixed right-6 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] md:bottom-6 w-14 h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-105 active:scale-95 z-50",
          state.isOpen && !isMobile ? "rotate-0" : "" // Rotate animation mostly for desktop X icon
        )}
      >
        {state.isOpen && !isMobile ? (
          <HugeiconsIcon icon={Cancel01Icon} size={24} strokeWidth={2} />
        ) : (
          <HugeiconsIcon icon={BubbleChatIcon} size={24} strokeWidth={2} />
        )}
        {!state.isOpen && supportUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white">
            {supportUnread > 9 ? '9+' : supportUnread}
          </span>
        )}
      </button>

      {/* Mobile: Drawer Interface */}
      {isMobile ? (
        <Drawer open={state.isOpen} onOpenChange={(open) => !open && closeDrawer()}>
          <DrawerContent className="h-[85vh] p-0 outline-none">
             <div className="sr-only">
               <DrawerTitle>Student Support</DrawerTitle>
               <DrawerDescription>Chat with support staff or mentors</DrawerDescription>
             </div>
             <div className="flex-1 h-full overflow-hidden rounded-t-[10px]">
                {renderContent()}
             </div>
          </DrawerContent>
        </Drawer>
      ) : (
        /* Desktop: Floating Window */
        state.isOpen && (
          <div 
            className={cn(
              "fixed bottom-24 right-6 w-[380px] h-[520px] bg-white rounded-xl flex flex-col overflow-hidden z-50 animate-in slide-in-from-bottom-4 duration-300 ease-out",
              chatWindowShadowClass
            )}
          >
            {renderContent()}
          </div>
        )
      )}
    </>
  );
};
