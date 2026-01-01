import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  receiverId: string;
  receiverName: string;
}

export const StudentDirectMessage = ({ receiverId, receiverName }: Props) => {
  const { profile } = useAuth();
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Fetch conversation
  const { data: messages, isLoading } = useQuery({
    queryKey: ['dm', profile?.user_id, receiverId],
    queryFn: async () => {
      if (!profile?.user_id || !receiverId) return [];
      
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${profile.user_id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${profile.user_id})`)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    // Poll every 3 seconds for new messages (simple realtime)
    refetchInterval: 3000 
  });

  // Send Mutation
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!message.trim()) return;
      const { error } = await supabase.from('direct_messages').insert({
        sender_id: profile?.user_id,
        receiver_id: receiverId,
        content: message.trim()
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['dm', profile?.user_id, receiverId] });
    }
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  return (
    <div className="h-[400px] flex flex-col">
      <ScrollArea className="flex-1 p-4 border rounded-md bg-gray-50 mb-4">
        {isLoading ? (
          <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>
        ) : messages?.length === 0 ? (
          <div className="text-center text-muted-foreground mt-10">
            <p>Start a conversation with {receiverName}!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages?.map((msg) => {
              const isMe = msg.sender_id === profile?.user_id;
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 ${isMe ? 'bg-primary text-primary-foreground' : 'bg-white border shadow-sm'}`}>
                    <p className="text-sm">{msg.content}</p>
                    <p className={`text-[10px] mt-1 text-right ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                      {format(new Date(msg.created_at), 'h:mm a')}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>

      <div className="flex gap-2">
        <Input 
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          onKeyDown={(e) => e.key === 'Enter' && sendMessage.mutate()}
        />
        <Button onClick={() => sendMessage.mutate()} disabled={!message.trim() || sendMessage.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
