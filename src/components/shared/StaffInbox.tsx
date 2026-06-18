import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Sent02Icon, Search01Icon, ArrowLeft01Icon, InboxIcon, Message01Icon } from '@hugeicons/core-free-icons';
import { format, isToday, isYesterday } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string | null;
  is_read: boolean | null;
  context?: string | null;
  subject_context?: string | null;
}

interface Contact {
  user_id: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  context?: string | null;
  subject_context?: string | null;
}

type FilterType = 'all' | 'support' | 'doubts';

// Deterministic, brand-aligned avatar tint so the list looks designed rather
// than relying on an external avatar service.
const AVATAR_TINTS = [
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-teal-100 text-teal-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
];
const tintFor = (name: string) =>
  AVATAR_TINTS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TINTS.length];
const initialsOf = (name: string) =>
  name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'U';

const listTime = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
};

export const StaffInbox = () => {
  const { profile } = useAuth();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Determine if current user is admin or manager
  const { data: staffRole } = useQuery({
    queryKey: ['staff-role', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return null;
      const [adminRes, managerRes, adminsAll, managersAll] = await Promise.all([
        supabase.from('admins').select('id').eq('user_id', profile.user_id).maybeSingle(),
        supabase.from('managers').select('id').eq('user_id', profile.user_id).maybeSingle(),
        supabase.from('admins').select('user_id').not('user_id', 'is', null),
        supabase.from('managers').select('user_id').not('user_id', 'is', null),
      ]);
      const allStaffIds = new Set([
        ...(adminsAll.data || []).map(a => a.user_id),
        ...(managersAll.data || []).map(m => m.user_id),
      ]);
      return {
        isAdmin: !!adminRes.data,
        isManager: !!managerRes.data,
        allStaffIds,
      };
    },
    enabled: !!profile?.user_id,
  });

  // Fetch Contacts — shared inbox for support conversations
  const { data: contacts, isLoading: loadingContacts } = useQuery({
    queryKey: ['inbox-contacts', profile?.user_id, staffRole?.isAdmin, staffRole?.isManager],
    queryFn: async () => {
      if (!profile?.user_id || !staffRole) return [];

      // Build OR filter: personal messages + shared support messages
      let orFilter = `sender_id.eq.${profile.user_id},receiver_id.eq.${profile.user_id}`;
      if (staffRole.isAdmin) orFilter += `,context.eq.support_admin`;
      if (staffRole.isManager) orFilter += `,context.eq.support_manager`;

      const { data: messages, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(orFilter)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching messages:", error);
        return [];
      }

      const contactMap = new Map<string, Contact>();

      for (const msg of messages) {
        const msgContext = (msg as Message).context;
        let otherId: string;

        // For support messages, "other" is always the student (non-staff party)
        if (msgContext === 'support_admin' || msgContext === 'support_manager') {
          if (staffRole.allStaffIds.has(msg.sender_id)) {
            otherId = msg.receiver_id;
          } else {
            otherId = msg.sender_id;
          }
          // Skip if we ARE the student somehow
          if (otherId === profile.user_id && staffRole.allStaffIds.has(profile.user_id)) {
            otherId = msg.sender_id === profile.user_id ? msg.receiver_id : msg.sender_id;
          }
        } else {
          otherId = msg.sender_id === profile.user_id ? msg.receiver_id : msg.sender_id;
        }

        if (!contactMap.has(otherId)) {
          contactMap.set(otherId, {
            user_id: otherId,
            name: 'Unknown User',
            lastMessage: msg.content || 'Attachment',
            lastMessageTime: msg.created_at || new Date().toISOString(),
            unreadCount: 0,
            context: msgContext || 'general',
            subject_context: (msg as Message).subject_context || null,
          });
        }

        // For support messages, count unread if student sent and not read
        if (msgContext === 'support_admin' || msgContext === 'support_manager') {
          if (!staffRole.allStaffIds.has(msg.sender_id) && msg.is_read === false) {
            const contact = contactMap.get(otherId)!;
            contact.unreadCount += 1;
          }
        } else if (msg.receiver_id === profile.user_id && msg.is_read === false) {
           const contact = contactMap.get(otherId)!;
           contact.unreadCount += 1;
        }
      }

      // Batch-fetch all contact names in ONE query instead of an N+1 sequential
      // lookup per contact — with a shared support inbox this is ~190 contacts,
      // and the old per-contact awaits made the inbox hang on "loading".
      const ids = Array.from(contactMap.keys()).filter(Boolean);
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', ids);
        (profs || []).forEach((p: { user_id: string; name: string | null }) => {
          const c = contactMap.get(p.user_id);
          if (c && p.name) c.name = p.name;
        });
      }

      return Array.from(contactMap.values());
    },
    enabled: !!profile?.user_id && !!staffRole,
    refetchInterval: 20000
  });

  // Filter contacts based on selected filter + search
  const filteredContacts = contacts?.filter(contact => {
    const matchesFilter =
      filter === 'all' ? true
      : filter === 'support' ? (contact.context === 'support_admin' || contact.context === 'support_manager')
      : contact.context === 'subject_doubt';
    const matchesSearch = !search.trim() || contact.name.toLowerCase().includes(search.trim().toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Fetch Messages for the selected contact
  const selectedContact = contacts?.find(c => c.user_id === selectedContactId);
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ['dm-messages', profile?.user_id, selectedContactId, selectedContact?.context],
    queryFn: async () => {
      if (!profile?.user_id || !selectedContactId) return [];

      const ctx = selectedContact?.context;

      // For support conversations, fetch ALL messages for this student + context
      // so any admin/manager can see the full conversation
      if (ctx === 'support_admin' || ctx === 'support_manager') {
        const { data, error } = await supabase
          .from('direct_messages')
          .select('*')
          .eq('context', ctx)
          .or(`sender_id.eq.${selectedContactId},receiver_id.eq.${selectedContactId}`)
          .order('created_at', { ascending: true });
        if (error) throw error;
        return data as Message[];
      }

      // For non-support, keep existing 1:1 logic
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${profile.user_id},receiver_id.eq.${selectedContactId}),and(sender_id.eq.${selectedContactId},receiver_id.eq.${profile.user_id})`)
        .order('created_at', { ascending: false })
        .limit(80);

      if (error) throw error;
      return ((data as Message[]) || []).reverse();
    },
    enabled: !!profile?.user_id && !!selectedContactId,
    refetchInterval: 15000
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selectedContactId]);

  useEffect(() => {
    if (selectedContactId && profile?.user_id && messages?.length) {
        const ctx = selectedContact?.context;

        // For support conversations, mark all student messages as read for the shared inbox
        if (ctx === 'support_admin' || ctx === 'support_manager') {
          const unreadExists = messages.some(m => m.sender_id === selectedContactId && !m.is_read);
          if (unreadExists) {
            supabase
              .from('direct_messages')
              .update({ is_read: true })
              .eq('sender_id', selectedContactId)
              .eq('context', ctx)
              .eq('is_read', false)
              .then(() => {
                queryClient.invalidateQueries({ queryKey: ['inbox-contacts'] });
              });
          }
        } else {
          const unreadExists = messages.some(m => m.receiver_id === profile.user_id && !m.is_read);
          if (unreadExists) {
            supabase
              .from('direct_messages')
              .update({ is_read: true })
              .eq('sender_id', selectedContactId)
              .eq('receiver_id', profile.user_id)
              .eq('is_read', false)
              .then(() => {
                queryClient.invalidateQueries({ queryKey: ['inbox-contacts'] });
              });
          }
        }
    }
  }, [selectedContactId, messages, profile?.user_id, queryClient, selectedContact?.context]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedContactId || !profile?.user_id) return;

    const tempMsg = newMessage;
    setNewMessage('');

    const { error } = await supabase.from('direct_messages').insert({
      sender_id: profile.user_id,
      receiver_id: selectedContactId,
      content: tempMsg,
      is_read: false,
      context: selectedContact?.context || 'general',
      subject_context: selectedContact?.subject_context || null,
    });

    if (error) {
      console.error("Error sending message:", error);
      setNewMessage(tempMsg);
    } else {
      queryClient.invalidateQueries({ queryKey: ['dm-messages'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-contacts'] });
    }
  };

  // A small pill describing the conversation type.
  const ContextPill = ({ contact }: { contact: Contact }) => {
    if (contact.context === 'support_admin' || contact.context === 'support_manager') {
      return (
        <span className="inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 ring-1 ring-rose-100">
          Support
        </span>
      );
    }
    if (contact.context === 'subject_doubt' && contact.subject_context) {
      return (
        <span className="inline-flex items-center rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 ring-1 ring-indigo-100">
          {contact.subject_context}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="flex h-[calc(100vh-130px)] min-h-[480px] border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm font-sans">
      {/* LEFT: Contact list — full width on mobile, hidden once a chat is open */}
      <div
        className={cn(
          'w-full md:w-[340px] md:shrink-0 md:border-r border-slate-200 flex-col bg-slate-50/40',
          selectedContactId ? 'hidden md:flex' : 'flex',
        )}
      >
        <div className="p-4 border-b border-slate-200 bg-white space-y-3">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={InboxIcon} size={20} className="text-brand" strokeWidth={1.9} />
            <h2 className="text-base font-semibold text-slate-900">Inbox</h2>
          </div>

          {/* Filter Tabs */}
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-8 bg-slate-100">
              <TabsTrigger value="all" className="text-xs data-[state=active]:bg-white data-[state=active]:text-brand">All</TabsTrigger>
              <TabsTrigger value="support" className="text-xs data-[state=active]:bg-white data-[state=active]:text-brand">Support</TabsTrigger>
              <TabsTrigger value="doubts" className="text-xs data-[state=active]:bg-white data-[state=active]:text-brand">Doubts</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative">
            <HugeiconsIcon icon={Search01Icon} size={16} className="absolute left-2.5 top-2.5 text-slate-400" strokeWidth={1.9} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search students…"
              className="pl-9 bg-white border-slate-200 focus-visible:ring-brand/30"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {loadingContacts ? (
             <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-slate-300"/></div>
          ) : filteredContacts?.length === 0 ? (
             <div className="p-10 text-center text-slate-400 text-sm">
               {search.trim() ? 'No students match your search.' : filter === 'all' ? 'No conversations yet.' : `No ${filter} conversations.`}
             </div>
          ) : (
            <div className="flex flex-col py-1">
              {filteredContacts?.map((contact) => {
                const active = selectedContactId === contact.user_id;
                return (
                  <button
                    key={contact.user_id}
                    onClick={() => setSelectedContactId(contact.user_id)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 text-left transition-colors',
                      active ? 'bg-brand/5' : 'hover:bg-slate-100/70',
                    )}
                  >
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold', tintFor(contact.name))}>
                      {initialsOf(contact.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn('truncate text-sm', active ? 'font-semibold text-brand' : 'font-medium text-slate-800')}>
                          {contact.name}
                        </span>
                        <span className="shrink-0 text-[11px] text-slate-400">
                          {contact.lastMessageTime ? listTime(contact.lastMessageTime) : ''}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <p className="flex-1 truncate text-xs text-slate-500">{contact.lastMessage}</p>
                        <ContextPill contact={contact} />
                        {contact.unreadCount > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-semibold text-white">
                            {contact.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* RIGHT: Chat — hidden on mobile until a contact is picked */}
      <div
        className={cn(
          'flex-1 flex-col bg-white',
          selectedContactId ? 'flex' : 'hidden md:flex',
        )}
      >
        {selectedContact ? (
          <>
            <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-3 md:px-4">
              <button
                onClick={() => setSelectedContactId(null)}
                className="md:hidden -ml-1 flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                aria-label="Back to inbox"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} size={22} strokeWidth={2} />
              </button>
              <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold', tintFor(selectedContact.name))}>
                {initialsOf(selectedContact.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">{selectedContact.name}</div>
                <div className="mt-0.5"><ContextPill contact={selectedContact} /></div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4 md:px-6 space-y-2 bg-slate-50/40" ref={scrollRef}>
              {loadingMessages ? (
                <div className="flex justify-center mt-10"><Loader2 className="h-6 w-6 animate-spin text-slate-300"/></div>
              ) : messages?.map((msg) => {
                const isMe = msg.sender_id === profile?.user_id;
                return (
                  <div key={msg.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[82%] sm:max-w-[70%] px-3.5 py-2 text-sm shadow-sm',
                        isMe
                          ? 'bg-brand text-white rounded-2xl rounded-br-md'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-bl-md',
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                      <p className={cn('mt-1 text-right text-[10px]', isMe ? 'text-white/70' : 'text-slate-400')}>
                        {msg.created_at ? format(new Date(msg.created_at), 'h:mm a') : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-200 bg-white p-3 md:p-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:pb-4">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1 rounded-full border-slate-200 bg-slate-50 focus-visible:ring-brand/30"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!newMessage.trim()}
                  className="h-10 w-10 shrink-0 rounded-full bg-brand hover:bg-brand/90 disabled:opacity-40"
                >
                  <HugeiconsIcon icon={Sent02Icon} size={18} strokeWidth={2} />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-slate-50/40 text-center px-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/5">
              <HugeiconsIcon icon={Message01Icon} size={30} className="text-brand/60" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Your conversations</p>
              <p className="mt-0.5 text-xs text-slate-400">Select a student to read and reply.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
