import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Image as ImageIcon, Reply, X, Users, Hash, Loader2, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

interface CommunityMessage {
  id: string;
  content: string | null;
  image_url: string | null;
  user_id: string;
  batch: string;
  subject: string;
  reply_to_id: string | null;
  created_at: string;
  profiles: {
    name: string;
  };
  reply_to?: {
    id: string;
    content: string | null;
    profiles: { name: string };
  };
}

interface UserEnrollment {
  batch_name: string;
  subject_name: string;
}

export const StudentCommunity = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedGroup, setSelectedGroup] = useState<UserEnrollment | null>(null);
  const [messageText, setMessageText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [replyingTo, setReplyingTo] = useState<CommunityMessage | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 1. Fetch User's Groups (Enrollments)
  const { data: enrollments = [], isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
    queryKey: ['community-enrollments', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      const { data, error } = await supabase
        .from('user_enrollments')
        .select('batch_name, subject_name')
        .eq('user_id', profile.user_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.user_id
  });

  // Auto-select first group
  useEffect(() => {
    if (!selectedGroup && enrollments.length > 0) {
      setSelectedGroup(enrollments[0]);
    }
  }, [enrollments, selectedGroup]);

  // 2. Fetch Messages for Selected Group
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<CommunityMessage[]>({
    queryKey: ['community-messages', selectedGroup?.batch_name, selectedGroup?.subject_name],
    queryFn: async () => {
      if (!selectedGroup) return [];
      
      // Fetch messages and join profile name + reply content
      const { data, error } = await supabase
        .from('community_messages')
        .select(`
          *,
          profiles (name),
          reply_to:community_messages!reply_to_id (
            id, content, profiles(name)
          )
        `)
        .eq('batch', selectedGroup.batch_name)
        .eq('subject', selectedGroup.subject_name)
        .order('created_at', { ascending: true });

      if (error) {
          console.error("Error fetching messages:", error);
          throw error;
      }
      return data as any[];
    },
    enabled: !!selectedGroup
  });

  // 3. Real-time Subscription
  useEffect(() => {
    if (!selectedGroup) return;

    const channel = supabase
      .channel(`community-${selectedGroup.batch_name}-${selectedGroup.subject_name}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_messages',
          filter: `batch=eq.${selectedGroup.batch_name}`,
        },
        () => {
            // Invalidate to fetch new message with profile details
            queryClient.invalidateQueries({ queryKey: ['community-messages', selectedGroup.batch_name, selectedGroup.subject_name] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedGroup, queryClient]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 4. Send Message Logic
  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.user_id || !selectedGroup) return;
      
      let imageUrl = null;

      // Upload Image if present
      if (selectedImage) {
        setIsUploading(true);
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${profile.user_id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('chat_uploads')
          .upload(filePath, selectedImage);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('chat_uploads')
          .getPublicUrl(filePath);
        
        imageUrl = publicUrl;
        setIsUploading(false);
      }

      // Insert Message
      const { error } = await supabase.from('community_messages').insert({
        content: messageText,
        image_url: imageUrl,
        user_id: profile.user_id,
        batch: selectedGroup.batch_name,
        subject: selectedGroup.subject_name,
        reply_to_id: replyingTo?.id || null
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setMessageText('');
      setSelectedImage(null);
      setReplyingTo(null);
    },
    onError: (error: any) => {
      setIsUploading(false);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handleSend = () => {
    if (!messageText.trim() && !selectedImage) return;
    sendMessageMutation.mutate();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedImage(e.target.files[0]);
    }
  };

  // Parse links in text
  const renderTextWithLinks = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, i) => 
      part.match(urlRegex) ? (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
          {part}
        </a>
      ) : part
    );
  };

  // --- UI Components ---

  const GroupList = () => (
    <div className={`bg-white border-r flex flex-col h-full ${isMobile && selectedGroup ? 'hidden' : 'w-full md:w-80'}`}>
      <div className="p-4 border-b bg-gray-50">
        <h2 className="font-bold text-lg flex items-center gap-2 text-gray-800">
          <Users className="h-5 w-5" /> Communities
        </h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {isLoadingEnrollments ? (
             <div className="p-4 text-center text-gray-500">Loading groups...</div>
          ) : enrollments.length > 0 ? (
            enrollments.map((group) => (
              <div
                key={`${group.batch_name}-${group.subject_name}`}
                onClick={() => setSelectedGroup(group)}
                className={`p-3 rounded-lg cursor-pointer transition-colors flex items-center gap-3 ${
                  selectedGroup?.batch_name === group.batch_name && selectedGroup?.subject_name === group.subject_name
                    ? 'bg-primary/10 border-primary/20 border'
                    : 'hover:bg-gray-100 border border-transparent'
                }`}
              >
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold shrink-0">
                  {group.subject_name[0]}
                </div>
                <div className="overflow-hidden">
                  <p className="font-semibold text-gray-900 truncate">{group.subject_name}</p>
                  <p className="text-xs text-gray-500 truncate">{group.batch_name}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500">
              <Users className="h-12 w-12 mx-auto text-gray-300 mb-2"/>
              <p className="text-sm">No communities found.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-gray-100">
      <GroupList />
      
      {/* Chat Area */}
      {!selectedGroup ? (
        <div className={`flex-1 flex items-center justify-center bg-gray-50 ${isMobile && !selectedGroup ? 'hidden' : ''}`}>
            <div className="text-center text-gray-400">
                <Hash className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Select a community to start chatting</p>
            </div>
        </div>
      ) : (
        <div className={`flex-1 flex flex-col h-full bg-slate-50 ${isMobile && !selectedGroup ? 'hidden' : 'w-full'}`}>
          {/* Chat Header */}
          <div className="p-4 bg-white border-b flex items-center justify-between shadow-sm z-10">
            <div className="flex items-center gap-3">
              {isMobile && (
                  <Button variant="ghost" size="icon" onClick={() => setSelectedGroup(null)}>
                      <Reply className="h-5 w-5" />
                  </Button>
              )}
              <Avatar>
                  <AvatarFallback className="bg-primary text-white">{selectedGroup.subject_name[0]}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-bold text-gray-800">{selectedGroup.subject_name} Community</h3>
                <p className="text-xs text-gray-500">{selectedGroup.batch_name}</p>
              </div>
            </div>
          </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {isLoadingMessages ? (
                  <div className="flex justify-center p-10"><Loader2 className="animate-spin h-8 w-8 text-gray-400" /></div>
              ) : messages.length === 0 ? (
                  <div className="text-center py-20 opacity-60">
                      <p>No messages yet. Be the first to say hello! 👋</p>
                  </div>
              ) : (
                  messages.map((msg) => {
                      const isMe = msg.user_id === profile?.user_id;
                      return (
                          <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''} group`}>
                              <Avatar className="h-8 w-8 mt-1">
                                  <AvatarFallback className={isMe ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200'}>
                                      {msg.profiles?.name?.[0] || '?'}
                                  </AvatarFallback>
                              </Avatar>
                              <div className={`max-w-[85%] md:max-w-[70%]`}>
                                  <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                                      <span className="text-xs font-semibold text-gray-600">{msg.profiles?.name || 'Unknown'}</span>
                                      <span className="text-[10px] text-gray-400">{format(new Date(msg.created_at), 'h:mm a')}</span>
                                  </div>
                                  
                                  <div className={`relative p-3 rounded-2xl shadow-sm ${
                                      isMe 
                                      ? 'bg-primary text-primary-foreground rounded-tr-none' 
                                      : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                                  }`}>
                                      {/* Reply Context */}
                                      {msg.reply_to && (
                                          <div className={`mb-2 p-2 rounded border-l-4 text-xs ${
                                              isMe ? 'bg-white/10 border-white/50' : 'bg-gray-50 border-gray-300'
                                          }`}>
                                              <p className="font-bold opacity-80">{msg.reply_to.profiles?.name}</p>
                                              <p className="truncate opacity-70">{msg.reply_to.content || 'Image Attachment'}</p>
                                          </div>
                                      )}

                                      {/* Image Content */}
                                      {msg.image_url && (
                                          <div className="mb-2 rounded-lg overflow-hidden">
                                              <img src={msg.image_url} alt="Shared content" className="max-w-full h-auto max-h-64 object-cover" />
                                          </div>
                                      )}
                                      
                                      {/* Text Content */}
                                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                                          {renderTextWithLinks(msg.content || '')}
                                      </p>

                                      {/* Hover Actions */}
                                      <button 
                                          onClick={() => setReplyingTo(msg)}
                                          className={`absolute -bottom-6 ${isMe ? 'left-0' : 'right-0'} opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-primary p-1`}
                                          title="Reply"
                                      >
                                          <Reply className="h-4 w-4" />
                                      </button>
                                  </div>
                              </div>
                          </div>
                      );
                  })
              )}
              <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t">
              {/* Reply Preview Panel */}
              {replyingTo && (
                  <div className="flex items-center justify-between bg-gray-50 p-2 rounded-lg mb-2 border-l-4 border-primary">
                      <div className="text-sm">
                          <span className="font-bold text-primary">Replying to {replyingTo.profiles?.name}</span>
                          <p className="text-gray-500 truncate max-w-xs">{replyingTo.content || 'Image'}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)}>
                          <X className="h-4 w-4" />
                      </Button>
                  </div>
              )}

              {/* Image Preview Panel */}
              {selectedImage && (
                  <div className="flex items-center justify-between bg-blue-50 p-2 rounded-lg mb-2">
                      <div className="flex items-center gap-2 text-sm text-blue-700">
                          <ImageIcon className="h-4 w-4" />
                          <span className="truncate max-w-xs">{selectedImage.name}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedImage(null)}>
                          <X className="h-4 w-4" />
                      </Button>
                  </div>
              )}

              <div className="flex items-end gap-2">
                  <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleFileSelect} 
                  />
                  <Button 
                      variant="outline" 
                      size="icon" 
                      className="shrink-0"
                      onClick={() => fileInputRef.current?.click()}
                  >
                      <Paperclip className="h-5 w-5 text-gray-500" />
                  </Button>
                  <Input
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleSend();
                          }
                      }}
                      placeholder="Type a message..."
                      className="flex-1 min-h-[44px] py-2"
                      disabled={isUploading || sendMessageMutation.isPending}
                  />
                  <Button 
                      onClick={handleSend} 
                      disabled={(!messageText.trim() && !selectedImage) || isUploading || sendMessageMutation.isPending}
                      className="shrink-0"
                  >
                      {isUploading || sendMessageMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </Button>
              </div>
          </div>
        </div>
      )}
    </div>
  );
};
