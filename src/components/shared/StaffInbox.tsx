import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Send, User, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// 1. Define flexible types that match your Supabase schema
// We allow nulls because database fields might be returned as null
interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string | null;
  is_read: boolean | null;
}

interface Contact {
  user_id: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export const StaffInbox = () => {
  const { profile } = useAuth();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // 2. Fetch Contacts (People who have chatted with you)
  const { data: contacts, isLoading: loadingContacts } = useQuery({
    queryKey: ['inbox-contacts', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];

      // Fetch all messages where you are sender OR receiver
      const { data: messages, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`sender_id.eq.${profile.user_id},receiver_id.eq.${profile.user_id}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching messages:", error);
        return [];
      }

      // Group messages by the "other" person
      const contactMap = new Map<string, Contact>();
      
      for (const msg of messages) {
        const otherId = msg.sender_id === profile.user_id ? msg.receiver_id : msg.sender_id;
        
        if (!contactMap.has(otherId)) {
          // Fetch name for this ID
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('name')
            .eq('user_id', otherId)
            .single();

          contactMap.set(otherId, {
            user_id: otherId,
            name: userProfile?.name || 'Unknown User',
            lastMessage: msg.content || 'Attachment',
            // Handle potentially null created_at
            lastMessageTime: msg.created_at || new Date().toISOString(),
            unreadCount: 0
          });
        }
        
        // Count unread messages (only if you are the receiver)
        if (msg.receiver_id === profile.user_id && msg.is_read === false) {
           const contact = contactMap.get(otherId)!;
           contact.unreadCount += 1;
        }
      }

      return Array.from(contactMap.values());
    },
    enabled: !!profile?.user_id,
    refetchInterval: 5000 // Poll every 5s for new chats
  });

  // 3. Fetch Messages for the selected contact
  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ['dm-messages', profile?.user_id, selectedContactId],
    queryFn: async () => {
      if (!profile?.user_id || !selectedContactId) return [];

      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${profile.user_id},receiver_id.eq.${selectedContactId}),and(sender_id.eq.${selectedContactId},receiver_id.eq.${profile.user_id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!profile?.user_id && !!selectedContactId,
    refetchInterval: 3000 // Poll active chat every 3s
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selectedContactId]);

  // Mark messages as read when you open the chat
  useEffect(() => {
    if (selectedContactId && profile?.user_id && messages?.length) {
        // Only update if there are unread messages
        const unreadExists = messages.some(m => m.receiver_id === profile.user_id && !m.is_read);
        
        if (unreadExists) {
          supabase
          .from('direct_messages')
          .update({ is_read: true })
          .eq('sender_id', selectedContactId)
          .eq('receiver_id', profile.user_id)
          .eq('is_read', false)
          .then(() => {
              // Refresh contacts to clear the notification badge
              queryClient.invalidateQueries({ queryKey: ['inbox-contacts'] });
          });
        }
    }
  }, [selectedContactId, messages, profile?.user_id, queryClient]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedContactId || !profile?.user_id) return;

    const tempMsg = newMessage;
    setNewMessage(''); // Clear input immediately

    const { error } = await supabase.from('direct_messages').insert({
      sender_id: profile.user_id,
      receiver_id: selectedContactId,
      content: tempMsg,
      is_read: false
    });

    if (error) {
      console.error("Error sending message:", error);
      setNewMessage(tempMsg); // Put text back if it failed
    } else {
      queryClient.invalidateQueries({ queryKey: ['dm-messages'] });
      queryClient.invalidateQueries({ queryKey: ['inbox-contacts'] });
    }
  };

  return (
    <div className="flex h-[calc(100vh-100px)] border rounded-xl overflow-hidden bg-white shadow-sm">
      {/* LEFT SIDE: Contact List */}
      <div className="w-1/3 border-r flex flex-col bg-gray-50/50 min-w-[250px]">
        <div className="p-4 border-b bg-white">
          <h2 className="text-lg font-semibold mb-3">Inbox</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input placeholder="Search messages..." className="pl-9 bg-gray-50" />
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          {loadingContacts ? (
             <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400"/></div>
          ) : contacts?.length === 0 ? (
             <p className="p-8 text-center text-gray-500 text-sm">No conversations yet.</p>
          ) : (
            <div className="flex flex-col">
              {contacts?.map((contact) => (
                <button
                  key={contact.user_id}
                  onClick={() => setSelectedContactId(contact.user_id)}
                  className={`flex items-start gap-3 p-4 text-left transition-colors hover:bg-gray-100 ${
                    selectedContactId === contact.user_id ? 'bg-blue-50/80 border-r-4 border-blue-600' : ''
                  }`}
                >
                  <Avatar>
                    <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${contact.name}`} />
                    <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="font-semibold text-sm truncate">{contact.name}</span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {contact.lastMessageTime ? format(new Date(contact.lastMessageTime), 'MMM d') : ''}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate line-clamp-1">{contact.lastMessage}</p>
                  </div>
                  {contact.unreadCount > 0 && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-medium text-white">
                      {contact.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* RIGHT SIDE: Chat Window */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedContactId ? (
          <>
            <div className="p-4 border-b flex items-center gap-3 shadow-sm bg-white z-10">
               <Avatar className="h-8 w-8">
                  <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${contacts?.find(c => c.user_id === selectedContactId)?.name}`} />
                  <AvatarFallback>U</AvatarFallback>
               </Avatar>
               <span className="font-semibold">{contacts?.find(c => c.user_id === selectedContactId)?.name}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30" ref={scrollRef}>
              {loadingMessages ? (
                <div className="flex justify-center mt-10"><Loader2 className="h-6 w-6 animate-spin text-gray-400"/></div>
              ) : messages?.map((msg) => {
                const isMe = msg.sender_id === profile?.user_id;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 shadow-sm ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-white border text-gray-800 rounded-bl-none'
                      }`}
                    >
                      <p className="text-sm">{msg.content}</p>
                      <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                        {msg.created_at ? format(new Date(msg.created_at), 'h:mm a') : ''}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t bg-white">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                />
                <Button type="submit" size="icon" disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 flex-col gap-2 bg-gray-50/30">
            <User className="h-12 w-12 opacity-20" />
            <p>Select a contact to view messages</p>
          </div>
        )}
      </div>
    </div>
  );
};
