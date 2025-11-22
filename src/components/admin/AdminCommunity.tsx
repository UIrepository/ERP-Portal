import { useState, useEffect, useRef, useMemo } from 'react';
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
  Loader2, 
  Paperclip, 
  AlertCircle,
  Megaphone,
  X,
  Ban
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Toggle } from "@/components/ui/toggle";
import { motion, AnimatePresence } from 'framer-motion';

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
  is_priority: boolean;
  profiles: { name: string } | null;
  message_likes: { user_id: string; reaction_type: string }[]; 
}

interface GroupInfo {
  batch_name: string;
  subject_name: string;
}

const getAvatarColor = (name: string) => {
  const colors = ['bg-red-100 text-red-700', 'bg-green-100 text-green-700', 'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-yellow-100 text-yellow-700', 'bg-pink-100 text-pink-700'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export const AdminCommunity = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const [selectedGroup, setSelectedGroup] = useState<GroupInfo | null>(null);
  const [messageText, setMessageText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [replyingTo, setReplyingTo] = useState<CommunityMessage | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPriority, setIsPriority] = useState(false);

  // Admin: Fetch ALL Groups (RLS allows Super Admin to see all)
  const { data: allGroups = [], isLoading: isLoadingGroups } = useQuery<GroupInfo[]>({
    queryKey: ['admin-all-groups'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_enrollments').select('batch_name, subject_name');
      if (error) throw error;
      const uniqueGroups = Array.from(new Set(data.map(item => JSON.stringify(item)))).map(str => JSON.parse(str));
      return uniqueGroups.sort((a, b) => a.batch_name.localeCompare(b.batch_name));
    }
  });

  useEffect(() => {
    if (!isMobile && !selectedGroup && allGroups.length > 0) setSelectedGroup(allGroups[0]);
  }, [allGroups, selectedGroup, isMobile]);

  useEffect(() => {
    setMessageText(''); setSelectedImage(null); setReplyingTo(null); setIsPriority(false);
  }, [selectedGroup]);

  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<CommunityMessage[]>({
    queryKey: ['community-messages', selectedGroup?.batch_name, selectedGroup?.subject_name],
    queryFn: async () => {
      if (!selectedGroup) return [];
      const { data, error } = await supabase
        .from('community_messages')
        .select(`*, profiles (name), message_likes ( user_id, reaction_type )`)
        .eq('batch', selectedGroup.batch_name)
        .eq('subject', selectedGroup.subject_name)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!selectedGroup
  });

  const groupedMessages = useMemo(() => {
    const groups: Record<string, CommunityMessage[]> = {};
    messages.forEach(msg => {
      const dateKey = format(new Date(msg.created_at), 'yyyy-MM-dd');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(msg);
    });
    return groups;
  }, [messages]);

  useEffect(() => {
    if (!selectedGroup) return;
    const refresh = () => { queryClient.invalidateQueries({ queryKey: ['community-messages', selectedGroup.batch_name, selectedGroup.subject_name] }); };
    const channel = supabase.channel(`community-${selectedGroup.batch_name}-${selectedGroup.subject_name}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_messages', filter: `batch=eq.${selectedGroup.batch_name}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_likes' }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedGroup, queryClient]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }); }, [messages?.length, selectedGroup]);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ text, image, replyId, priority }: { text: string; image: File | null; replyId: string | null, priority: boolean }) => {
      if (!profile?.user_id || !selectedGroup) return;
      let imageUrl = null;
      if (image) {
        setIsUploading(true);
        const fileExt = image.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${profile.user_id}/${fileName}`;
        await supabase.storage.from('chat_uploads').upload(filePath, image);
        const { data } = supabase.storage.from('chat_uploads').getPublicUrl(filePath);
        imageUrl = data.publicUrl;
        setIsUploading(false);
      }
      const { error } = await supabase.from('community_messages').insert({
        content: text,
        image_url: imageUrl,
        user_id: profile.user_id,
        batch: selectedGroup.batch_name,
        subject: selectedGroup.subject_name,
        reply_to_id: replyId,
        is_priority: priority
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessageText(''); setSelectedImage(null); setReplyingTo(null); setIsPriority(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (e: any) => { setIsUploading(false); toast({ title: "Error", description: e.message, variant: "destructive" }); }
  });

  const handleSend = () => {
    if (!messageText.trim() && !selectedImage) return;
    sendMessageMutation.mutate({
      text: messageText,
      image: selectedImage,
      replyId: replyingTo?.id || null,
      priority: isPriority
    });
  };

  const MessageItemAdmin = ({ msg }: { msg: CommunityMessage }) => {
    const isMe = msg.user_id === profile?.user_id;
    const priorityClass = msg.is_priority 
      ? "bg-rose-50 border-2 border-rose-200 text-rose-900" 
      : isMe ? "bg-teal-700 text-white" : "bg-white text-gray-800 border border-gray-200";
    const bubbleShapeClass = isMe 
      ? "rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl rounded-br-none" 
      : "rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-none";

    if (msg.is_deleted) {
      return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} my-2`}>
            <div className={`text-gray-400 text-xs italic px-3 py-1.5 border border-dashed border-gray-300 rounded-lg flex items-center gap-2 select-none bg-white/50`}>
              <Ban className="h-3 w-3" />
              <span>Message deleted {msg.profiles?.name}</span>
            </div>
        </motion.div>
      );
    }

    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} 
        className={`flex w-full ${isMe ? 'justify-end' : 'justify-start items-end gap-2'} mb-2 px-2`}
      >
        {!isMe && (
          <Avatar className="h-8 w-8 mb-1 shadow-sm border border-white ring-2 ring-gray-50">
              <AvatarFallback className={`${getAvatarColor(msg.profiles?.name || '?')} text-[10px] font-bold`}>
                  {msg.profiles?.name?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
          </Avatar>
        )}
        <div className={`relative px-4 py-3 shadow-sm text-sm max-w-[85%] ${bubbleShapeClass} ${priorityClass}`}>
          {msg.is_priority && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-rose-600 uppercase mb-1"><Megaphone className="h-3 w-3 fill-rose-600" /> Priority Announcement</div>
          )}
          {!isMe && <div className={`text-[11px] font-bold mb-1 ${msg.is_priority ? 'text-rose-700' : 'text-teal-600'}`}>{msg.profiles?.name}</div>}
          <p className={`whitespace-pre-wrap ${isMe && !msg.is_priority ? 'text-white/95' : 'text-gray-800'}`}>{msg.content}</p>
          {msg.image_url && <img src={msg.image_url} alt="Attachment" className="max-w-full h-auto max-h-72 object-cover rounded-md mt-2" />}
          <div className={`text-[10px] text-right mt-1 ${isMe && !msg.is_priority ? 'text-teal-100' : 'text-gray-400'}`}>{format(new Date(msg.created_at), 'h:mm a')}</div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex h-[100dvh] w-full bg-[#fdfbf7] relative overflow-hidden">
      <div className={`bg-white border-r flex flex-col h-full z-20 transition-all duration-300 ease-in-out ${isMobile ? (selectedGroup ? 'hidden' : 'w-full') : 'w-80'}`}>
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-lg flex items-center gap-2 text-gray-800"><Megaphone className="h-5 w-5 text-red-600" /> Admin Chat</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoadingGroups ? <div className="p-6 text-center text-gray-500"><Loader2 className="animate-spin mx-auto" /></div> : 
             allGroups.map((group) => (
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
        <div className={`flex-1 flex flex-col items-center justify-center bg-gray-50 text-gray-400 ${isMobile ? 'hidden' : 'flex'}`}>
          <Users className="h-10 w-10 text-teal-200 mb-4" />
          <p className="text-lg font-medium text-gray-600">Select a group to manage</p>
        </div>
      )}

      {selectedGroup && (
        <div className={`flex-1 flex flex-col h-full relative ${isMobile ? 'w-full fixed inset-0 z-50 bg-[#fdfbf7]' : 'w-full'}`}>
          <div className="px-4 py-3 bg-white border-b flex items-center justify-between shadow-sm z-20 relative">
            <div className="flex items-center gap-3">
              {isMobile && <Button variant="ghost" size="icon" onClick={() => { setSelectedGroup(null); }}><ArrowLeft className="h-5 w-5" /></Button>}
              <Avatar className="h-9 w-9 border border-gray-200">
                <AvatarFallback className="bg-teal-600 text-white font-bold rounded-full">{selectedGroup.subject_name[0]}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-bold text-gray-800 leading-none flex items-center gap-2 text-base">
                  {selectedGroup.subject_name}
                </h3>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{selectedGroup.batch_name} (Admin View)</p>
              </div>
            </div>
          </div>

          <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url('/logoofficial.png')`, backgroundSize: '60px', backgroundRepeat: 'repeat', backgroundPosition: 'center' }} />

          <div className="flex-1 overflow-y-auto p-4 space-y-4 z-10 pb-24 md:pb-4" ref={scrollAreaRef}>
             {Object.entries(groupedMessages).map(([dateKey, dateMessages]) => (
               <div key={dateKey} className="space-y-3">
                 <div className="flex justify-center sticky top-0 z-10 py-2">
                    <div className="bg-white/90 backdrop-blur border border-gray-200 text-gray-500 text-[11px] font-medium px-3 py-0.5 rounded-full shadow-sm select-none">
                        {format(parseISO(dateKey), 'MMM d, yyyy')}
                    </div>
                 </div>
                 <AnimatePresence>
                 {dateMessages.map((msg) => <MessageItemAdmin key={msg.id} msg={msg} />)}
                 </AnimatePresence>
               </div>
             ))}
             <div ref={messagesEndRef} />
          </div>

          <div className="p-3 md:p-4 bg-white border-t z-20">
            {replyingTo && (
              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg mb-3 border-l-4 border-teal-500">
                <div className="flex flex-col px-2">
                    <span className="text-xs font-bold text-teal-600">Replying to...</span>
                    <span className="text-xs text-gray-500 truncate">{replyingTo.content}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setReplyingTo(null)}><X className="h-4 w-4" /></Button>
              </div>
            )}

            <div className="flex items-end gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200">
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={(e) => e.target.files && setSelectedImage(e.target.files[0])} />
              <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}><Paperclip className="h-5 w-5 text-gray-500" /></Button>
              
              <Input 
                value={messageText} 
                onChange={(e) => setMessageText(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} 
                placeholder="Type an admin message..." 
                className="flex-1 border-none bg-transparent focus-visible:ring-0" 
                disabled={isUploading || sendMessageMutation.isPending} 
              />

              <Toggle 
                pressed={isPriority} 
                onPressedChange={setIsPriority} 
                className="h-10 w-10 rounded-lg data-[state=on]:bg-rose-100 data-[state=on]:text-rose-600" 
                aria-label="Toggle priority"
              >
                <AlertCircle className={`h-5 w-5 ${isPriority ? 'fill-rose-600 text-rose-600' : 'text-gray-400'}`} />
              </Toggle>

              <Button onClick={handleSend} disabled={(!messageText.trim() && !selectedImage) || isUploading} className={`h-10 w-10 p-0 rounded-lg ${isPriority ? 'bg-rose-600 hover:bg-rose-700' : 'bg-teal-700 hover:bg-teal-800'}`}>
                {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 ml-0.5" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
