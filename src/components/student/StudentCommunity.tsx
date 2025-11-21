import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Send, 
  Image as ImageIcon, 
  Reply, 
  ArrowLeft, 
  Users, 
  Hash, 
  Loader2, 
  Paperclip, 
  Trash2, 
  X,
  Heart
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// --- Interfaces ---
interface CommunityMessage {
  id: string;
  content: string | null;
  image_url: string | null;
  user_id: string;
  batch: string;
  subject: string;
  reply_to_id: string | null;
  created_at: string;
  is_deleted: boolean;
  profiles: { name: string };
  // Reply object
  reply_to?: {
    id: string;
    content: string | null;
    image_url: string | null;
    user_id: string; 
    is_deleted: boolean;
    profiles: { name: string };
  } | any; // Type relaxation for safety if array comes back
  // Likes array
  message_likes: { user_id: string }[];
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

  // --- State ---
  const [selectedGroup, setSelectedGroup] = useState<UserEnrollment | null>(null);
  const [messageText, setMessageText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [replyingTo, setReplyingTo] = useState<CommunityMessage | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null); 

  // --- 1. Fetch Groups ---
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

  // Auto-select first group (Desktop only)
  useEffect(() => {
    if (!isMobile && !selectedGroup && enrollments.length > 0) {
      setSelectedGroup(enrollments[0]);
    }
  }, [enrollments, selectedGroup, isMobile]);

  // Clear inputs when switching groups to prevent ghost replies
  useEffect(() => {
    setMessageText('');
    setSelectedImage(null);
    setReplyingTo(null);
  }, [selectedGroup]);

  // --- 2. Fetch Messages ---
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<CommunityMessage[]>({
    queryKey: ['community-messages', selectedGroup?.batch_name, selectedGroup?.subject_name],
    queryFn: async () => {
      if (!selectedGroup) return [];
      
      // Uses auto-detection for relationships
      const { data, error } = await supabase
        .from('community_messages')
        .select(`
          *,
          profiles (name),
          reply_to:community_messages!reply_to_id (
            id, content, image_url, user_id, is_deleted, profiles(name)
          ),
          message_likes ( user_id )
        `)
        .eq('batch', selectedGroup.batch_name)
        .eq('subject', selectedGroup.subject_name)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedGroup
  });

  // --- 3. Real-time ---
  useEffect(() => {
    if (!selectedGroup) return;
    
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['community-messages', selectedGroup.batch_name, selectedGroup.subject_name] });
    };

    const channel = supabase
      .channel(`community-${selectedGroup.batch_name}-${selectedGroup.subject_name}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_messages', filter: `batch=eq.${selectedGroup.batch_name}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_likes' }, refresh)
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [selectedGroup, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages, selectedGroup]);

  // --- 4. Mutations ---
  const sendMessageMutation = useMutation({
    mutationFn: async ({ text, image, replyId }: { text: string; image: File | null; replyId: string | null }) => {
      if (!profile?.user_id || !selectedGroup) return;
      let imageUrl = null;

      if (image) {
        setIsUploading(true);
        const fileExt = image.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${profile.user_id}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('chat_uploads').upload(filePath, image);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('chat_uploads').getPublicUrl(filePath);
        imageUrl = publicUrl;
        setIsUploading(false);
      }

      const { error } = await supabase.from('community_messages').insert({
        content: text,
        image_url: imageUrl,
        user_id: profile.user_id,
        batch: selectedGroup.batch_name,
        subject: selectedGroup.subject_name,
        reply_to_id: replyId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessageText('');
      setSelectedImage(null);
      setReplyingTo(null); // Clears reply state so next message is clean
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (e: any) => { setIsUploading(false); toast({ title: "Error", description: e.message, variant: "destructive" }); }
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('community_messages').update({ is_deleted: true }).eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData(
        ['community-messages', selectedGroup?.batch_name, selectedGroup?.subject_name],
        (old: CommunityMessage[] | undefined) => old ? old.filter(m => m.id !== id) : []
      );
      toast({ title: "Message deleted" });
      setDeleteId(null);
    },
    onError: (e: any) => toast({ title: "Failed to delete", description: e.message, variant: "destructive" })
  });

  const toggleLikeMutation = useMutation({
    mutationFn: async ({ msgId, isLiked }: { msgId: string, isLiked: boolean }) => {
      if (isLiked) {
        await supabase.from('message_likes').delete().match({ message_id: msgId, user_id: profile?.user_id });
      } else {
        await supabase.from('message_likes').insert({ message_id: msgId, user_id: profile?.user_id });
      }
    }
  });

  const handleSend = () => {
    if (!messageText.trim() && !selectedImage) return;
    sendMessageMutation.mutate({
        text: messageText,
        image: selectedImage,
        replyId: replyingTo?.id || null
    });
  };

  // --- Helpers ---
  const renderTextWithLinks = (text: string | null) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => part.match(urlRegex) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">{part}</a>
    ) : part);
  };

  // Logic to get the preview text. Returns NULL if invalid, keeping UI clean.
  const getReplyPreview = (reply: any) => {
    if (!reply) return null;
    if (reply.is_deleted) return '🗑️ Message deleted';
    if (reply.content && reply.content.trim().length > 0) return reply.content;
    if (reply.image_url) return '📷 Photo';
    return null; // Crucial: Returns null if no content, so box won't render
  };

  // --- Render ---
  return (
    <div className="flex h-[calc(100vh-4rem)] w-full bg-[#efeae2] relative overflow-hidden">
      
      {/* GROUP LIST */}
      <div className={`bg-white border-r flex flex-col h-full z-20 transition-all duration-300 ease-in-out ${isMobile ? (selectedGroup ? 'hidden' : 'w-full') : 'w-80'}`}>
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-lg flex items-center gap-2 text-gray-800"><Users className="h-5 w-5 text-teal-600" /> Communities</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoadingEnrollments ? <div className="p-6 text-center text-gray-500 flex justify-center"><Loader2 className="animate-spin" /></div> : 
             enrollments.length === 0 ? <div className="p-6 text-center text-gray-500">No communities found.</div> :
             enrollments.map((group) => (
              <div key={`${group.batch_name}-${group.subject_name}`} onClick={() => setSelectedGroup(group)}
                className={`p-3 rounded-lg cursor-pointer transition-colors flex items-center gap-3 ${selectedGroup?.batch_name === group.batch_name && selectedGroup?.subject_name === group.subject_name ? 'bg-teal-50 border-teal-200 border' : 'hover:bg-gray-100 border border-transparent'}`}>
                <div className="h-10 w-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold shrink-0">{group.subject_name[0]}</div>
                <div className="overflow-hidden text-left"><p className="font-semibold text-gray-900 truncate">{group.subject_name}</p><p className="text-xs text-gray-500 truncate">{group.batch_name}</p></div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* EMPTY STATE */}
      {!selectedGroup && (
        <div className={`flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] text-gray-500 border-l-4 border-teal-600 ${isMobile ? 'hidden' : 'flex'}`}>
          <Hash className="h-20 w-20 mb-4 opacity-20" />
          <p className="text-lg font-medium">Select a community to start chatting</p>
        </div>
      )}

      {/* CHAT AREA */}
      {selectedGroup && (
        <div className={`flex-1 flex flex-col h-full relative ${isMobile ? 'w-full fixed inset-0 z-50 bg-[#efeae2]' : 'w-full'}`}>
          
          {/* Header */}
          <div className="p-3 bg-white border-b flex items-center justify-between shadow-sm z-20">
            <div className="flex items-center gap-3">
              {isMobile && <Button variant="ghost" size="icon" onClick={() => setSelectedGroup(null)} className="-ml-2 mr-1"><ArrowLeft className="h-5 w-5" /></Button>}
              <Avatar className="h-10 w-10 border border-gray-200"><AvatarFallback className="bg-teal-600 text-white font-bold">{selectedGroup.subject_name[0]}</AvatarFallback></Avatar>
              <div>
                <h3 className="font-bold text-gray-800 leading-tight">{selectedGroup.subject_name}</h3>
                <p className="text-xs text-gray-500">{selectedGroup.batch_name}</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#efeae2] pb-24 md:pb-4">
            {isLoadingMessages ? <div className="flex justify-center p-10"><Loader2 className="animate-spin h-8 w-8 text-gray-400" /></div> : 
             messages.length === 0 ? <div className="text-center py-20 opacity-50 text-sm">No messages yet.</div> :
             messages.map((msg) => {
               const isMe = msg.user_id === profile?.user_id;
               const hasImage = msg.image_url && msg.image_url.trim() !== '';
               const hasContent = msg.content && msg.content.trim() !== '';
               
               // Safely handle potential array return for reply_to
               const replyData = Array.isArray(msg.reply_to) ? msg.reply_to[0] : msg.reply_to;
               
               // Get actual reply text. If null, the block below won't render.
               const replyText = replyData ? getReplyPreview(replyData) : null;
               const isReplyToMe = replyData?.user_id === profile?.user_id;
               const replySenderName = isReplyToMe ? "You" : replyData?.profiles?.name;
               
               // Colors for reply bar
               const replyBorderColor = isReplyToMe ? "border-teal-500" : "border-purple-500";
               const replyNameColor = isReplyToMe ? "text-teal-600" : "text-purple-600";
               
               const isLiked = msg.message_likes?.some(l => l.user_id === profile?.user_id);
               const likeCount = msg.message_likes?.length || 0;

               return (
                 <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} group mb-1`}>
                   <div className={`relative max-w-[85%] md:max-w-[65%] rounded-lg p-2 shadow-sm text-sm ${
                     isMe ? 'bg-[#dcf8c6] rounded-tr-none' : 'bg-white rounded-tl-none'
                   }`}>
                     
                     {/* Name (Others) */}
                     {!isMe && <div className="text-[11px] font-bold text-orange-600 mb-0.5 px-1">{msg.profiles?.name}</div>}

                     {/* REPLY BLOCK (Only shows if replyText is valid) */}
                     {msg.reply_to_id && replyText && (
                       <div 
                        className={`mb-1.5 rounded-md bg-black/5 border-l-[3px] ${replyBorderColor} p-1.5 flex flex-col justify-center cursor-pointer select-none shadow-sm`}
                        onClick={() => {
                          const el = document.getElementById(`msg-${msg.reply_to_id}`);
                          if(el) el.scrollIntoView({behavior: 'smooth', block: 'center'});
                        }}
                       >
                         <span className={`text-[10px] font-bold ${replyNameColor} mb-0.5`}>{replySenderName}</span>
                         <span className="text-[11px] text-gray-700 truncate line-clamp-2">{replyText}</span>
                       </div>
                     )}

                     {/* Content */}
                     <div className="text-gray-900 px-1" id={`msg-${msg.id}`}>
                        {hasImage && <div className="mb-1 rounded-lg overflow-hidden mt-1"><img src={msg.image_url!} alt="Attachment" className="max-w-full h-auto max-h-80 object-cover rounded-md cursor-pointer" onClick={() => window.open(msg.image_url!, '_blank')} /></div>}
                        {hasContent && <p className="whitespace-pre-wrap leading-relaxed break-words text-[15px]">{renderTextWithLinks(msg.content)}</p>}
                     </div>

                     {/* Footer: Actions + Info */}
                     <div className="flex justify-between items-end mt-1 pt-1 border-t border-black/5 gap-2">
                        
                        {/* Actions (Inside Bubble - Mobile Friendly) */}
                        <div className="flex items-center gap-1">
                           <button onClick={() => toggleLikeMutation.mutate({ msgId: msg.id, isLiked })} className="p-1 hover:bg-black/5 rounded-full transition-colors">
                              <Heart className={`h-3.5 w-3.5 ${isLiked ? 'text-red-500 fill-red-500' : 'text-gray-400'}`} />
                           </button>
                           <button onClick={() => setReplyingTo(msg)} className="p-1 hover:bg-black/5 rounded-full transition-colors">
                              <Reply className="h-3.5 w-3.5 text-gray-400" />
                           </button>
                           {isMe && (
                              <button onClick={() => setDeleteId(msg.id)} className="p-1 hover:bg-red-100 rounded-full transition-colors">
                                 <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                              </button>
                           )}
                        </div>

                        {/* Info Row: Likes + Time */}
                        <div className="flex items-center gap-2">
                            {likeCount > 0 && (
                            <div className="flex items-center bg-black/5 px-1.5 rounded-full h-4">
                                <Heart className="h-2 w-2 text-red-500 fill-red-500 mr-0.5" />
                                <span className="text-[9px] font-bold text-gray-600">{likeCount}</span>
                            </div>
                            )}
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">{format(new Date(msg.created_at), 'h:mm a')}</span>
                        </div>
                     </div>

                   </div>
                 </div>
               );
             })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-2 md:p-3 bg-[#f0f2f5] border-t z-20">
            {/* Reply Preview Bar */}
            {replyingTo && (
              <div className="flex items-center justify-between bg-white p-2 rounded-lg mb-2 border-l-4 border-teal-500 shadow-sm animate-in slide-in-from-bottom-2">
                <div className="flex flex-col px-2">
                    <span className="text-xs font-bold text-teal-600">Replying to {replyingTo.user_id === profile?.user_id ? 'You' : replyingTo.profiles?.name}</span>
                    <span className="text-xs text-gray-500 truncate max-w-[250px]">{getReplyPreview(replyingTo) || 'Attachment'}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyingTo(null)}><X className="h-4 w-4 text-gray-500" /></Button>
              </div>
            )}

            {/* Image Preview */}
            {selectedImage && (
              <div className="flex items-center justify-between bg-blue-50 p-2 rounded-lg mb-2 border border-blue-100 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-blue-100 rounded flex items-center justify-center text-blue-600"><ImageIcon className="h-5 w-5"/></div>
                    <div className="text-sm text-blue-900 truncate max-w-[200px] font-medium">{selectedImage.name}</div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-100 rounded-full" onClick={() => setSelectedImage(null)}><X className="h-4 w-4 text-blue-500" /></Button>
              </div>
            )}

            <div className="flex items-end gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200">
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => e.target.files && setSelectedImage(e.target.files[0])} />
              <Button variant="ghost" size="icon" className="h-10 w-10 text-gray-500 hover:bg-gray-100 rounded-full shrink-0" onClick={() => fileInputRef.current?.click()}><Paperclip className="h-5 w-5" /></Button>
              <Input value={messageText} onChange={(e) => setMessageText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} placeholder="Type a message" className="flex-1 border-none shadow-none focus-visible:ring-0 min-h-[40px] py-2 text-[15px]" disabled={isUploading || sendMessageMutation.isPending} />
              <Button onClick={handleSend} disabled={(!messageText.trim() && !selectedImage) || isUploading} className="h-10 w-10 rounded-full bg-teal-600 hover:bg-teal-700 text-white shrink-0 p-0 flex items-center justify-center">{isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 ml-0.5" />}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Delete Message?</AlertDialogTitle>
                <AlertDialogDescription>This message will be removed for everyone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteId && deleteMessageMutation.mutate(deleteId)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
