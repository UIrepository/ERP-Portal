
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Send, User } from 'lucide-react';
import { format } from 'date-fns';

interface ChatMessage {
  id: string;
  message: string;
  sender_id: string;
  receiver_role: string;
  subject: string;
  batch: string;
  sender_name: string;
  created_at: string;
}

export const StudentChatTeacher = () => {
  const { profile } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState('');
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: teachers } = useQuery({
    queryKey: ['batch-teachers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'teacher')
        .eq('batch', profile?.batch)
        .contains('subjects', profile?.subjects || []);
      return data || [];
    },
    enabled: !!profile?.batch && !!profile?.subjects
  });

  const { data: chatMessages } = useQuery({
    queryKey: ['student-teacher-chat', selectedSubject],
    queryFn: async (): Promise<ChatMessage[]> => {
      if (!selectedSubject) return [];
      
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('subject', selectedSubject)
        .eq('batch', profile?.batch)
        .or(`sender_id.eq.${profile?.user_id},receiver_role.eq.student`)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedSubject && !!profile?.batch
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: any) => {
      const { error } = await supabase
        .from('chat_messages')
        .insert([messageData]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-teacher-chat', selectedSubject] });
      setMessage('');
    },
  });

  const handleSendMessage = () => {
    if (!message.trim() || !selectedSubject) return;

    sendMessageMutation.mutate({
      message: message.trim(),
      sender_id: profile?.user_id,
      receiver_role: 'teacher',
      subject: selectedSubject,
      batch: profile?.batch,
      sender_name: profile?.name,
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">💬 Chat with Teacher</h2>
        <div className="flex gap-2">
          <Badge variant="outline">Batch: {profile?.batch}</Badge>
          <Badge variant="outline">Subjects: {profile?.subjects?.join(', ')}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Subject</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a subject to chat about" />
            </SelectTrigger>
            <SelectContent>
              {profile?.subjects?.map((subject) => (
                <SelectItem key={subject} value={subject}>{subject}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedSubject && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare className="mr-2 h-5 w-5" />
              {selectedSubject} - Teacher Chat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-96 overflow-y-auto border rounded-lg p-4 space-y-3">
                {chatMessages && chatMessages.length > 0 ? (
                  chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_id === profile?.user_id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] p-3 rounded-lg ${
                          msg.sender_id === profile?.user_id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <User className="h-3 w-3" />
                          <span className="text-xs font-medium">
                            {msg.sender_id === profile?.user_id ? 'You' : `Teacher (${selectedSubject})`}
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
                    <MessageSquare className="h-12 w-12 mx-auto mb-4" />
                    <p>No messages yet. Start the conversation!</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="flex gap-2">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message..."
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button onClick={handleSendMessage} disabled={!message.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
