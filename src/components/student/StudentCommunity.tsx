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
  X 
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
  is_deleted: boolean; // Added field
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

  useEffect(() => {
    if (!isMobile && !selectedGroup && enrollments.length > 0) {
      setSelectedGroup(enrollments[0]);
    }
  }, [enrollments, selectedGroup, isMobile]);

  // --- 2. Fetch Messages (Filtered) ---
  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<CommunityMessage[]>({
    queryKey: ['community-messages', selectedGroup?.batch_name, selectedGroup?.subject_name],
    queryFn: async () => {
      if (!selectedGroup) return [];
      
      const { data, error } = await supabase
        .from('community_messages')
        .select(`
          id, content, image_url, user_id, batch, subject, reply_to_id, created_at, is_deleted,
          profiles (name),
          reply_to:community_messages!reply_to_id (
            id, content, image_url, profiles(name)
          )
        `)
        .eq('batch', selectedGroup.batch_name)
        .eq('subject', selectedGroup.subject_name)
        .eq('is_deleted', false) // FILTER: Only fetch non-deleted messages
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedGroup
  });

  // --- 3. Real-time ---
  useEffect(() => {
    if (!selectedGroup) return;
    const channel = supabase
      .channel(`community-${selectedGroup.batch_name}-${selectedGroup.subject_name}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_messages', filter: `batch=eq.${selectedGroup.batch_name}` }, 
        (payload) => {
          // If a message was updated to be deleted, invalidate query to remove it
          if (payload.eventType === 'UPDATE' && (payload.new as any).is_deleted === true) {
             queryClient.invalidateQueries({ queryKey: ['community-messages', selectedGroup.batch_name, selectedGroup.subject_name] });
          } else if (payload.eventType === 'INSERT') {
             queryClient.invalidateQueries({ queryKey: ['community-messages', selectedGroup.batch_name, selectedGroup.subject_name] });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedGroup, queryClient]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages, selectedGroup]);

  // --- 4. Actions ---
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

  // Updated: Soft Delete Mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('community_messages')
        .update({ is_deleted: true }) // Soft delete action
        .eq('id', id);
      
      if (error) throw error;
      return id;
    },
    onSuccess: (deletedId) => {
      // Instant UI update
      queryClient.setQueryData(
        ['community-messages', selectedGroup?.batch_name, selectedGroup?.subject_name],
        (oldMessages: CommunityMessage[] | undefined) => {
            return oldMessages ? oldMessages.filter(msg => msg.id !== deletedId) : [];
        }
      );
      toast({ title: "Message deleted" });
      setDeleteId(null);
    },
    onError: (error: any) => {
      console.error(error);
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" })
    }
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
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all">{part}</a>
    ) : part);
  };

  const getReplyPreview = (reply: NonNullable<CommunityMessage['reply_to']>) => {
    if (reply.content && reply.content.trim().length > 0) return reply.content;
    if (reply.image_url) return '📷 Photo';
    return null;
  };

  // --- Render ---
  return (
    <div className="flex h-[calc(100vh-4rem)] w-full bg-[#efeae2] relative overflow-hidden">
      
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

      {!selectedGroup && (
        <div className={`flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] text-gray-500 border-l-4 border-teal-600 ${isMobile ? 'hidden' : 'flex'}`}>
          <Hash className="h-20 w-20 mb-4 opacity-20" />
          <p className="text-lg font-medium">Select a community to start chatting</p>
          <p className="text-sm opacity-70">Connect with your peers and teachers.</p>
        </div>
      )}

      {selectedGroup && (
        <div className={`flex-1 flex flex-col h-full relative ${isMobile ? 'w-full fixed inset-0 z-50 bg-[#efeae2]' : 'w-full'}`}>
          
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

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#efeae2] pb-24 md:pb-4">
            <div className="text-center text-xs text-gray-400 my-4 bg-gray-200/50 py-1 px-3 rounded-full w-fit mx-auto">Messages are end-to-end visible to group members</div>
            {isLoadingMessages ? <div className="flex justify-center p-10"><Loader2 className="animate-spin h-8 w-8 text-gray-400" /></div> : 
             messages.length === 0 ? <div className="text-center py-20 opacity-50 text-sm">No messages yet. Start the conversation!</div> :
             messages.map((msg) => {
               const isMe = msg.user_id === profile?.user_id;
               const hasImage = msg.image_url && msg.image_url.trim() !== '';
               const hasContent = msg.content && msg.content.trim() !== '';
               const replyText = msg.reply_to ? getReplyPreview(msg.reply_to) : null;

               return (
                 <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} group mb-1`}>
                   <div className={`relative max-w-[85%] md:max-w-[65%] rounded-lg p-2 shadow-sm text-sm ${
                     isMe ? 'bg-[#E7FFDB] rounded-tr-none' : 'bg-white rounded-tl-none'
                   }`}>
                     
                     <div className="flex justify-between items-start gap-4 mb-1">
                       <span className={`text-xs font-bold ${isMe ? 'text-teal-600' : 'text-orange-600'}`}>
                         {isMe ? 'You' : msg.profiles?.name}
                       </span>
                     </div>

                     {msg.reply_to && replyText && (
                       <div className="mb-2 rounded-[4px] bg-black/5 border-l-4 border-teal-500 p-1 px-2 flex flex-col justify-center cursor-pointer opacity-90 hover:opacity-100">
                         <span className="text-[10px] font-bold text-teal-700">{msg.reply_to.profiles?.name}</span>
                         <span className="text-[11px] text-gray-600 truncate max-w-[200px]">{replyText}</span>
                       </div>
                     )}

                     <div className="text-gray-800">
                        {hasImage && <div className="mb-1 rounded-lg overflow-hidden mt-1"><img src={msg.image_url!} alt="Attachment" className="max-w-full h-auto max-h-80 object-cover rounded-md" /></div>}
                        {hasContent && <p className="whitespace-pre-wrap leading-relaxed break-words text-[15px]">{renderTextWithLinks(msg.content)}</p>}
                     </div>

                     <div className="flex justify-end items-center gap-1 mt-1">
                        <span className="text-[10px] text-gray-400 min-w-[40px] text-right">{format(new Date(msg.created_at), 'h:mm a')}</span>
                     </div>

                     <div className={`absolute top-0 ${isMe ? '-left-20' : '-right-20'} hidden group-hover:flex items-center h-full gap-1 px-2 transition-all`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 bg-white/80 shadow-sm rounded-full hover:bg-white" onClick={() => setReplyingTo(msg)} title="Reply">
                            <Reply className="h-4 w-4 text-gray-600" />
                        </Button>
                        {isMe && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 bg-white/80 shadow-sm rounded-full hover:bg-red-50" onClick={() => setDeleteId(msg.id)} title="Delete">
                              <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                     </div>

                   </div>
                 </div>
               );
             })}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-2 md:p-3 bg-[#f0f2f5] border-t z-20">
            {replyingTo && (
              <div className="flex items-center justify-between bg-white p-2 rounded-lg mb-2 border-l-4 border-teal-500 shadow-sm animate-in slide-in-from-bottom-2">
                <div className="flex flex-col px-2">
                    <span className="text-xs font-bold text-teal-600">Replying to {replyingTo.profiles?.name}</span>
                    <span className="text-xs text-gray-500 truncate max-w-[250px]">{getReplyPreview(replyingTo) || 'Attachment'}</span>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReplyingTo(null)}><X className="h-4 w-4 text-gray-500" /></Button>
              </div>
            )}

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
              <Button variant="ghost" size="icon" className="h-10 w-10 text-gray-500 hover:bg-gray-100 rounded-full shrink-0" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="h-5 w-5" />
              </Button>
              
              <Input 
                value={messageText} 
                onChange={(e) => setMessageText(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} 
                placeholder="Type a message" 
                className="flex-1 border-none shadow-none focus-visible:ring-0 min-h-[40px] py-2 text-[15px]" 
                disabled={isUploading || sendMessageMutation.isPending} 
              />
              
              <Button 
                onClick={handleSend} 
                disabled={(!messageText.trim() && !selectedImage) || isUploading} 
                className="h-10 w-10 rounded-full bg-teal-600 hover:bg-teal-700 text-white shrink-0 p-0 flex items-center justify-center"
              >
                {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 ml-0.5" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Delete Message?</AlertDialogTitle>
                <AlertDialogDescription>
                    This message will be deleted for everyone.
                </AlertDialogDescription>
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
