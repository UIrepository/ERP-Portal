import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Send, MessageSquare, User } from 'lucide-react';
import { format } from 'date-fns';

export const TeacherMessages = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const [selectedAdmin, setSelectedAdmin] = useState<string | null>(null);

  const { data: admins } = useQuery({
    queryKey: ['adminsForMessages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admins')
        .select('id, name, email, user_id');
      if (error) throw error;
      return data || [];
    }
  });

  const { data: messages, isLoading } = useQuery({
    queryKey: ['teacherDirectMessages', user?.id, selectedAdmin],
    queryFn: async () => {
      if (!user?.id || !selectedAdmin) return [];
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedAdmin}),and(sender_id.eq.${selectedAdmin},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id && !!selectedAdmin
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedAdmin || !newMessage.trim()) return;
      const { error } = await supabase
        .from('direct_messages')
        .insert({
          sender_id: user.id,
          receiver_id: selectedAdmin,
          content: newMessage.trim()
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacherDirectMessages'] });
      setNewMessage('');
    },
    onError: () => {
      toast.error('Failed to send message');
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Messages</h2>
        <p className="text-muted-foreground">Communicate with administrators</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Administrators</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <div className="space-y-1">
              {admins?.map((admin) => (
                <Button
                  key={admin.id}
                  variant={selectedAdmin === admin.user_id ? 'secondary' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setSelectedAdmin(admin.user_id)}
                >
                  <User className="h-4 w-4 mr-2" />
                  {admin.name}
                </Button>
              ))}
              {!admins?.length && (
                <p className="text-sm text-muted-foreground p-2">No administrators available</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedAdmin ? `Chat with ${admins?.find(a => a.user_id === selectedAdmin)?.name}` : 'Select an administrator'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedAdmin ? (
              <div className="space-y-4">
                <ScrollArea className="h-[400px] border rounded-lg p-4">
                  {messages?.length ? (
                    <div className="space-y-3">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[70%] p-3 rounded-lg ${
                            msg.sender_id === user?.id 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-muted'
                          }`}>
                            <p>{msg.content}</p>
                            <p className={`text-xs mt-1 ${msg.sender_id === user?.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                              {format(new Date(msg.created_at!), 'h:mm a')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-muted-foreground">No messages yet. Start a conversation!</p>
                    </div>
                  )}
                </ScrollArea>
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage.mutate()}
                  />
                  <Button onClick={() => sendMessage.mutate()} disabled={!newMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[400px]">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Select an administrator to start messaging</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
