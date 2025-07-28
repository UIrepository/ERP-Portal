
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Shield, Send, User } from 'lucide-react';
import { format } from 'date-fns';

interface FounderChatMessage {
  id: string;
  message: string;
  student_id: string;
  student_name: string;
  student_batch: string;
  is_from_student: boolean;
  created_at: string;
}

export const StudentChatFounder = () => {
  const { profile } = useAuth();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: chatMessages } = useQuery({
    queryKey: ['student-founder-chat'],
    queryFn: async (): Promise<FounderChatMessage[]> => {
      const { data, error } = await (supabase as any)
        .from('founder_chat_messages')
        .select('*')
        .eq('student_id', profile?.user_id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return (data || []) as FounderChatMessage[];
    },
    enabled: !!profile?.user_id
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: any) => {
      const { error } = await (supabase as any)
        .from('founder_chat_messages')
        .insert([messageData]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-founder-chat'] });
      setMessage('');
    },
  });

  const handleSendMessage = () => {
    if (!message.trim()) return;

    sendMessageMutation.mutate({
      message: message.trim(),
      student_id: profile?.user_id,
      student_name: profile?.name,
      student_batch: profile?.batch,
      is_from_student: true,
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center">
          <Shield className="mr-2 h-6 w-6 text-blue-600" />
          Chat with Founder
        </h2>
        <div className="flex gap-2">
          <Badge variant="outline">Direct Support</Badge>
          <Badge variant="outline">Batch: {profile?.batch}</Badge>
        </div>
      </div>

      <Card className="border-blue-200">
        <CardHeader className="bg-blue-50">
          <CardTitle className="flex items-center text-blue-800">
            <Shield className="mr-2 h-5 w-5" />
            Direct Line to Founder
          </CardTitle>
          <p className="text-sm text-blue-600">
            Have concerns, suggestions, or need direct support? Message the founder here.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-4 p-4">
            <div className="h-96 overflow-y-auto border rounded-lg p-4 space-y-3">
              {chatMessages && chatMessages.length > 0 ? (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.is_from_student ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] p-3 rounded-lg ${
                        msg.is_from_student
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-blue-100 text-blue-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {msg.is_from_student ? (
                          <User className="h-3 w-3" />
                        ) : (
                          <Shield className="h-3 w-3" />
                        )}
                        <span className="text-xs font-medium">
                          {msg.is_from_student ? 'You' : 'Founder'}
                        </span>
                      </div>
                      <p className="text-sm">{msg.message}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {format(new Date(msg.created_at), 'MMM dd, HH:mm')}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <Shield className="h-12 w-12 mx-auto mb-4 text-blue-400" />
                  <p>No messages yet. Feel free to reach out!</p>
                  <p className="text-sm mt-2">The founder personally reads and responds to all messages.</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message to the founder..."
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <Button onClick={handleSendMessage} disabled={!message.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
