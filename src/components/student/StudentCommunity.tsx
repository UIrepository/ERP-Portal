import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, Image as ImageIcon, Reply, ArrowLeft, Users, Hash, Loader2, Paperclip, Trash2, X } from 'lucide-react';
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
    image_url: string | null;
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

  useEffect(() => {
    if (!isMobile && !selectedGroup && enrollments.length > 0) {
      setSelectedGroup(enrollments[0]);
    }
  }, [enrollments, selectedGroup, isMobile]);

  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<CommunityMessage[]>({
    queryKey: ['community-messages', selectedGroup?.batch_name, selectedGroup?.subject_name],
    queryFn: async () => {
      if (!selectedGroup) return [];
      
      const { data, error } = await supabase
        .from('community_messages')
        .select(`
          *,
          profiles (name),
          reply_to:community_messages!reply_to_id (
            id, content, image_url, profiles(name)
          )
        `)
        .eq('batch', selectedGroup.batch_name)
        .eq('subject', selectedGroup.subject_name)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedGroup
  });

  useEffect(() => {
    if (!selectedGroup) return;
    const channel = supabase
      .channel(`community-${selectedGroup.batch_name}-${selectedGroup.subject_name}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_messages', filter: `batch=eq.${selectedGroup.batch_name}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['community-messages', selectedGroup.batch_name, selectedGroup.subject_name] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedGroup, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedGroup]);

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.user_id || !selectedGroup) return;
      let imageUrl = null;

      if (selectedImage) {
        setIsUploading(true);
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${profile.user_id}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('chat_uploads').upload(filePath, selectedImage);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('chat_uploads').getPublicUrl(filePath);
        imageUrl = publicUrl;
        setIsUploading(false);
      }

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
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (e: any) => { setIsUploading(false); toast({ title: "Error", description: e.message, variant: "destructive" }); }
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('community_messages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => toast({ title: "Message deleted" }),
    onError: () => toast({ title: "Failed to delete", variant: "destructive" })
  });

  const handleSend = () => {
    if (!messageText.trim() && !selectedImage) return;
    sendMessageMutation.mutate();
  };

  const renderTextWithLinks = (text: string | null) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => part.match(urlRegex) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">{part}</a>
    ) : part);
  };

  const getReplyPreviewText = (reply: NonNullable<CommunityMessage['reply_to']>) => {
    if (reply.content && reply.content.trim().length > 0) return reply.content;
    if (reply.image_url) return '📷 Photo';
    return 'Message unavailable';
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-gray-100 w-full">
      {/* Group List Sidebar */}
      <div className={`bg-white border-r flex flex-col h-full ${isMobile ? (selectedGroup ? 'hidden' : 'w-full') : 'w-80'}`}>
        <div className="p-4 border-b bg-gray-50">
          <h2 className="font-bold text-lg flex items-center gap-2 text-gray-800"><Users className="h-5 w-5" /> Communities</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {isLoadingEnrollments ? <div className="p-4 text-center text-gray-500">Loading...</div> : 
             enrollments.length === 0 ? <div className="p-4 text-center text-gray-500">No communities found.</div> :
             enrollments.map((group) => (
              <div key={`${group.batch_name}-${group.subject_name}`} onClick={() => setSelectedGroup(group)}
                className={`p-3 rounded-lg cursor-pointer transition-colors flex items-center gap-3 ${selectedGroup?.batch_name === group.batch_name && selectedGroup?.subject_name === group.subject_name ? 'bg-primary/10 border-primary/20 border' : 'hover:bg-gray-100 border border-transparent'}`}>
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold shrink-0">{group.subject_name[0]}</div>
                <div className="overflow-hidden text-left"><p className="font-semibold text-gray-900 truncate">{group.subject_name}</p><p className="text-xs text-gray-500 truncate">{group.batch_name}</p></div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      {!selectedGroup ? (
        <div className={`flex-1 flex items-center justify-center bg-gray-50 ${isMobile ? 'hidden' : 'flex'}`}>
          <div className="text-center text-gray-400"><Hash className="h-16 w-16 mx-auto mb-4 opacity-50" /><p>Select a community to start chatting</p></div>
        </div>
      ) : (
        <div className={`flex-1 flex flex-col h-full bg-slate-50 ${isMobile ? 'w-full fixed inset-0 z-50 bg-white' : 'w-full relative'}`}>
          <div className="p-3 md:p-4 bg-white border-b flex items-center justify-between shadow-sm z-10">
            <div className="flex items-center gap-3">
              {isMobile && <Button variant="ghost" size="icon" onClick={() => setSelectedGroup(null)} className="-ml-2"><ArrowLeft className="h-5 w-5" /></Button>}
              <Avatar><AvatarFallback className="bg-primary text-white">{selectedGroup.subject_name[0]}</AvatarFallback></Avatar>
              <div><h3 className="font-bold text-gray-800 text-sm md:text-base">{selectedGroup.subject_name}</h3><p className="text-xs text-gray-500">{selectedGroup.batch_name}</p></div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white pb-20 md:pb-4">
            {isLoadingMessages ? <div className="flex justify-center p-10"><Loader2 className="animate-spin h-8 w-8 text-gray-400" /></div> : 
             messages.length === 0 ? <div className="text-center py-20 opacity-60"><p>No messages yet.</p></div> :
             messages.map((msg) => {
               const isMe = msg.user_id === profile?.user_id;
               const hasImage = msg.image_url && msg.image_url.trim() !== '';
               const hasContent = msg.content && msg.content.trim() !== '';

               return (
                 <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''} group`}>
                   <Avatar className="h-8 w-8 mt-1 shrink-0"><AvatarFallback className={isMe ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-200'}>{msg.profiles?.name?.[0] || '?'}</AvatarFallback></Avatar>
                   <div className={`max-w-[85%] md:max-w-[70%]`}>
                     <div className={`flex items-center gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                       <span className="text-xs font-semibold text-gray-600">{msg.profiles?.name || 'Unknown'}</span>
                       <span className="text-[10px] text-gray-400">{format(new Date(msg.created_at), 'h:mm a')}</span>
                     </div>
                     <div className={`relative p-3 rounded-2xl shadow-sm ${isMe ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none'}`}>
                       {msg.reply_to && (
                         <div className={`mb-2 p-2 rounded border-l-4 text-xs ${isMe ? 'bg-white/10 border-white/50' : 'bg-white border-gray-300'}`}>
                           <p className="font-bold opacity-80">{msg.reply_to.profiles?.name}</p>
                           <p className="truncate opacity-70">{getReplyPreviewText(msg.reply_to)}</p>
                         </div>
                       )}
                       {hasImage && <div className="mb-2 rounded-lg overflow-hidden"><img src={msg.image_url!} alt="Shared" className="max-w-full h-auto max-h-64 object-cover" /></div>}
                       {hasContent && <p className="whitespace-pre-wrap text-sm leading-relaxed break-words">{renderTextWithLinks(msg.content)}</p>}
                       
                       <div className={`absolute -bottom-6 ${isMe ? 'left-0' : 'right-0'} flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity`}>
                         <button onClick={() => setReplyingTo(msg)} className="text-gray-400 hover:text-primary p-1" title="Reply"><Reply className="h-4 w-4" /></button>
                         {isMe && <button onClick={() => deleteMessageMutation.mutate(msg.id)} className="text-gray-400 hover:text-red-500 p-1" title="Delete"><Trash2 className="h-4 w-4" /></button>}
                       </div>
                     </div>
                   </div>
                 </div>
               );
             })}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 md:p-4 bg-white border-t">
            {replyingTo && <div className="flex justify-between bg-gray-50 p-2 rounded-lg mb-2 border-l-4 border-primary"><div className="text-sm"><span className="font-bold text-primary">Replying to {replyingTo.profiles?.name}</span><p className="text-gray-500 truncate">{getReplyPreviewText(replyingTo as any)}</p></div><Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)}><X className="h-4 w-4" /></Button></div>}
            {selectedImage && <div className="flex justify-between bg-blue-50 p-2 rounded-lg mb-2"><div className="flex items-center gap-2 text-sm text-blue-700"><ImageIcon className="h-4 w-4" /><span>{selectedImage.name}</span></div><Button variant="ghost" size="sm" onClick={() => setSelectedImage(null)}><X className="h-4 w-4" /></Button></div>}
            <div className="flex items-end gap-2">
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => e.target.files && setSelectedImage(e.target.files[0])} />
              <Button variant="outline" size="icon" className="shrink-0" onClick={() => fileInputRef.current?.click()}><Paperclip className="h-5 w-5 text-gray-500" /></Button>
              <Input value={messageText} onChange={(e) => setMessageText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} placeholder="Type a message..." className="flex-1 min-h-[44px] py-2" disabled={isUploading || sendMessageMutation.isPending} />
              <Button onClick={handleSend} disabled={(!messageText.trim() && !selectedImage) || isUploading} className="shrink-0">{isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
