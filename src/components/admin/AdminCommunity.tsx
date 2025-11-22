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
  Trash2, 
  X,
  Ban,
  AlertCircle,
  Megaphone,
  Lock
} from 'lucide-react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Toggle } from "@/components/ui/toggle";
import { motion, AnimatePresence } from 'framer-motion';
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

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

// --- Full Featured Message Component (Reused/Adapted) ---
const MessageItemAdmin = ({ 
  msg, 
  isMe, 
  replyData, 
  replyText, 
  onReply, 
  onDelete, 
  onReact, 
  profile 
}: {
  msg: CommunityMessage,
  isMe: boolean,
  replyData: CommunityMessage | undefined | null,
  replyText: string | null,
  onReply: (msg: CommunityMessage) => void,
  onDelete: (id: string) => void,
  onReact: (msgId: string, type: string) => void,
  profile: any
}) => {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [translateX, setTranslateX] = useState(0);
  const isSwiping = useRef(false);

  const renderTextWithLinks = (text: string | null, isMe: boolean, isPriority: boolean) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    const linkColor = isMe && !isPriority ? 'text-teal-100 hover:text-white' : 'text-teal-600 hover:text-teal-800';
    return parts.map((part, i) => part.match(urlRegex) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={`${linkColor} underline break-all`}>{part}</a>
    ) : part);
  };

  const isReplyToMe = replyData?.user_id === profile?.user_id;
  const replySenderName = isReplyToMe ? "You" : replyData?.profiles?.name;
  const replyBorderColor = isMe ? "border-teal-300/50" : "border-teal-500";
  const replyNameColor = isMe ? "text-teal-100" : "text-teal-700";
  const replyTextColor = isMe ? "text-teal-50/80" : "text-gray-500";
  const replyBg = isMe ? "bg-black/10" : "bg-gray-50";

  const myReaction = msg.message_likes?.find(l => l.user_id === profile?.user_id);
  const reactionsCount = msg.message_likes?.length || 0;
  const reactionCounts = msg.message_likes?.reduce((acc: any, curr) => {
    const type = curr.reaction_type || 'like';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    isSwiping.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || !isSwiping.current) return;
    setTouchEnd(e.targetTouches[0].clientX);
    const currentX = e.targetTouches[0].clientX;
    const diff = currentX - touchStart;
    if (isMe && diff < 0 && diff > -100) setTranslateX(diff);
    else if (!isMe && diff > 0 && diff < 100) setTranslateX(diff);
  };

  const onTouchEnd = () => {
    isSwiping.current = false;
    if (!touchStart || !touchEnd) { setTranslateX(0); return; }
    const distance = touchStart - touchEnd;
    if (isMe && distance > 50) onReply(msg);
    else if (!isMe && distance < -50) onReply(msg);
    setTranslateX(0);
    setTouchStart(null);
    setTouchEnd(null);
  };

  if (msg.is_deleted) {
    const isDeletedBySender = msg.user_id === profile?.user_id;
    const deletedText = isDeletedBySender 
      ? `Message deleted ${msg.profiles?.name}` 
      : 'Message deleted by moderator';

    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }}
        className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} my-2`}
      >
        <div className={`text-gray-400 text-xs italic px-3 py-1.5 border border-dashed border-gray-300 rounded-lg flex items-center gap-2 select-none bg-white/50`}>
           <Ban className="h-3 w-3" />
           <span>{deletedText}</span>
        </div>
      </motion.div>
    );
  }

  const bubbleShapeClass = isMe 
    ? "rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl rounded-br-none" 
    : "rounded-tl-2xl rounded-tr-2xl rounded-br-2xl rounded-bl-none";

  const priorityClass = msg.is_priority 
    ? "bg-rose-50 border-2 border-rose-200 text-rose-900 shadow-md" 
    : isMe 
      ? "bg-teal-700 text-white" 
      : "bg-white text-gray-800 border border-gray-200";

  // ADMIN DELETE LOGIC: Admin can delete any message.
  const canDelete = isMe || profile?.role === 'super_admin'; 

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`flex w-full ${isMe ? 'justify-end' : 'justify-start items-end gap-2'} group mb-2 relative px-2`}
      style={{ transform: `translateX(${translateX}px)` }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {translateX !== 0 && (
        <div className={`absolute top-1/2 -translate-y-1/2 ${isMe ? 'right-full mr-4' : 'left-full ml-4'} text-gray-400`}>
          <Reply className="h-5 w-5" />
        </div>
      )}

      {!isMe && (
        <Avatar className="h-8 w-8 mb-1 shadow-sm border border-white ring-2 ring-gray-50">
            <AvatarFallback className={`${getAvatarColor(msg.profiles?.name || '?')} text-[10px] font-bold`}>
                {msg.profiles?.name?.substring(0, 2).toUpperCase()}
            </AvatarFallback>
        </Avatar>
      )}

      <ContextMenu>
        <ContextMenuTrigger className={`block max-w-[85%] md:max-w-[65%] relative ${reactionsCount > 0 ? 'mb-5' : 'mb-0'}`}>
          <div className={`relative px-4 py-3 shadow-sm text-sm transition-all ${bubbleShapeClass} ${priorityClass}`}>
            
            {/* Priority Badge */}
            {msg.is_priority && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-1.5 pb-1 border-b border-rose-200/50">
                <Megaphone className="h-3 w-3 fill-rose-600" /> 
                Priority Announcement
              </div>
            )}

            {!isMe && !msg.is_priority && <div className="text-[11px] font-bold text-teal-600 mb-1">{msg.profiles?.name}</div>}
            {!isMe && msg.is_priority && <div className="text-[11px] font-bold text-rose-700 mb-1">{msg.profiles?.name}</div>}

            {replyData && replyText && (
              <div 
               className={`mb-2 rounded-md ${replyBg} border-l-4 ${replyBorderColor} p-2 flex flex-col justify-center cursor-pointer select-none`}
               onClick={(e) => {
                 e.stopPropagation(); 
                 const el = document.getElementById(`msg-${msg.reply_to_id}`);
                 if(el) el.scrollIntoView({behavior: 'smooth', block: 'center'});
               }}
              >
                <span className={`text-[10px] font-bold ${replyNameColor} mb-0.5`}>{replySenderName}</span>
                <span className={`text-[11px] ${replyTextColor} line-clamp-1`}>{replyText}</span>
              </div>
            )}

            <div className="" id={`msg-${msg.id}`}>
               {msg.image_url && msg.image_url.trim() !== '' && (
                 <div className="mb-2 rounded-lg overflow-hidden">
                   <img 
                     src={msg.image_url} 
                     alt="Attachment" 
                     className="max-w-full h-auto max-h-72 object-cover rounded-md cursor-pointer hover:opacity-95 transition-opacity" 
                     onClick={() => window.open(msg.image_url!, '_blank')} 
                   />
                 </div>
               )}
               {msg.content && msg.content.trim() !== '' && (
                 <p className={`whitespace-pre-wrap leading-relaxed break-words text-[15px] ${isMe && !msg.is_priority ? 'text-white/95' : 'text-gray-800'}`}>
                   {renderTextWithLinks(msg.content, isMe, msg.is_priority)}
                 </p>
               )}
            </div>

            <div className={`flex justify-end items-center mt-1 gap-1 min-w-[50px]`}>
               <span className={`text-[10px] ${isMe && !msg.is_priority ? 'text-teal-100' : 'text-gray-400'} whitespace-nowrap ml-auto`}>
                 {format(new Date(msg.created_at), 'h:mm a')}
               </span>
            </div>

            {reactionsCount > 0 && (
              <div className={`absolute -bottom-4 ${isMe ? 'right-0' : 'left-0'} z-10 flex items-center gap-1 bg-white rounded-full px-2 py-0.5 shadow-sm border border-gray-200 text-[10px] cursor-pointer hover:scale-105 transition-transform`}>
                {Object.entries(reactionCounts).map(([type, count]) => (
                  <span key={type} className="flex items-center">
                    {type === 'like' ? '👍' : type === 'love' ? '❤️' : type === 'laugh' ? '😂' : type === 'dislike' ? '👎' : '👍'} 
                    {Number(count) > 1 && <span className="ml-0.5 font-bold text-gray-600">{String(count)}</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        </ContextMenuTrigger>
        
        <ContextMenuContent className="w-48">
            <div className="flex justify-around p-2 bg-slate-50 rounded-md mb-2">
              {['👍', '❤️', '😂', '👎'].map(emoji => {
                const typeMap: Record<string, string> = { '👍': 'like', '❤️': 'love', '😂': 'laugh', '👎': 'dislike' };
                const type = typeMap[emoji];
                return (
                  <ContextMenuItem key={emoji} asChild onSelect={() => onReact(msg.id, type)}>
                    <button className={`text-lg hover:scale-125 transition-transform p-1 cursor-pointer border-none bg-transparent outline-none ${myReaction?.reaction_type === type ? 'bg-blue-100 rounded-full' : ''}`}>
                      {emoji}
                    </button>
                  </ContextMenuItem>
                )
              })}
            </div>
            
            {myReaction && (
              <>
                <ContextMenuItem onSelect={() => onReact(msg.id, myReaction.reaction_type)} className="text-red-500 focus:text-red-600">
                  <X className="mr-2 h-4 w-4" /> Remove Reaction
                </ContextMenuItem>
                <ContextMenuSeparator />
              </>
            )}

            <ContextMenuItem onSelect={() => onReply(msg)}>
              <Reply className="mr-2 h-4 w-4" /> Reply
            </ContextMenuItem>
            {canDelete && (
              <ContextMenuItem onSelect={() => onDelete(msg.id)} className="text-red-600 focus:text-red-600">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </ContextMenuItem>
            )}
        </ContextMenuContent>
      </ContextMenu>
    </motion.div>
  );
};
// --- END MessageItemAdmin ---


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
  const [deleteId, setDeleteId] = useState<string | null>(null); 

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date());
  
  // Admin: Fetch ALL Groups 
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

  const messageMap = useMemo(() => {
    const map = new Map<string, CommunityMessage>();
    messages.forEach(msg => map.set(msg.id, msg));
    return map;
  }, [messages]);

  const groupedMessages = useMemo(() => {
    const groups: Record<string, CommunityMessage[]> = {};
    messages.forEach(msg => {
      const dateKey = format(new Date(msg.created_at), 'yyyy-MM-dd');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(msg);
    });
    return groups;
  }, [messages]);

  const activeDates = useMemo(() => {
    return Object.keys(groupedMessages).map(dateStr => new Date(dateStr));
  }, [groupedMessages]);

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

  const deleteMessageMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('community_messages').update({ is_deleted: true }).eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-messages'] });
      toast({ title: "Message deleted" });
      setDeleteId(null);
    },
    onError: (e: any) => toast({ title: "Failed to delete", description: e.message, variant: "destructive" })
  });

  const toggleReactionMutation = useMutation({
    mutationFn: async ({ msgId, type }: { msgId: string, type: string }) => {
      const existingReaction = messages.find(m => m.id === msgId)?.message_likes.find(l => l.user_id === profile?.user_id);
      if (existingReaction) {
        if (existingReaction.reaction_type === type) {
          await supabase.from('message_likes').delete().match({ message_id: msgId, user_id: profile?.user_id });
        } else {
          await supabase.from('message_likes').update({ reaction_type: type }).match({ message_id: msgId, user_id: profile?.user_id });
        }
      } else {
        await supabase.from('message_likes').insert({ message_id: msgId, user_id: profile?.user_id, reaction_type: type });
      }
    },
    onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['community-messages'] });
    }
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

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setCalendarDate(date);
    setIsCalendarOpen(false);
    const dateId = format(date, 'yyyy-MM-dd');
    const element = document.getElementById(`date-${dateId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      toast({ title: `Jumped to ${format(date, 'MMM d, yyyy')}` });
    } else {
      toast({ title: "No messages found for this date", variant: "destructive" });
    }
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
            <div className="flex justify-center mb-6 mt-2">
                <div className="text-gray-400 text-[10px] font-medium flex items-center gap-1.5 select-none bg-gray-200/50 px-3 py-1 rounded-full border border-gray-200 backdrop-blur-sm">
                    <Lock className="h-3 w-3" />
                    <span>Messages are end-to-end encrypted. No one outside of this chat can read them.</span>
                </div>
            </div>

            {isLoadingMessages ? <div className="flex justify-center p-10"><Loader2 className="animate-spin h-8 w-8 text-teal-400" /></div> : 
             Object.keys(groupedMessages).length === 0 ? <div className="text-center py-20 text-gray-400 text-sm">No messages yet. Break the ice!</div> :
             Object.entries(groupedMessages).map(([dateKey, dateMessages]) => (
               <div key={dateKey} id={`date-${dateKey}`} className="space-y-3">
                 <div className="flex justify-center sticky top-0 z-10 py-2">
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild>
                            <div className="bg-white/90 backdrop-blur border border-gray-200 text-gray-500 text-[11px] font-medium px-3 py-0.5 rounded-full shadow-sm cursor-pointer hover:bg-gray-50 transition-colors select-none">
                                {isToday(parseISO(dateKey)) ? 'Today' : isYesterday(parseISO(dateKey)) ? 'Yesterday' : format(parseISO(dateKey), 'MMMM d, yyyy')}
                            </div>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-white" align="center">
                            <Calendar
                                mode="single"
                                selected={calendarDate}
                                onSelect={handleDateSelect}
                                initialFocus
                                modifiers={{ highlighted: activeDates }}
                                modifiersStyles={{ highlighted: { fontWeight: 'bold', color: '#4a3728', textDecoration: 'underline' } }}
                            />
                        </PopoverContent>
                    </Popover>
                 </div>
                 <AnimatePresence>
                 {dateMessages.map((msg) => (
                    <MessageItemAdmin
                       key={msg.id}
                       msg={msg}
                       isMe={msg.user_id === profile?.user_id}
                       replyData={messageMap.get(msg.reply_to_id || '')} // Admin map has all messages
                       replyText={messageMap.get(msg.reply_to_id || '')?.content || 'Message'}
                       onReply={setReplyingTo}
                       onDelete={(id) => setDeleteId(id)}
                       onReact={(msgId, type) => toggleReactionMutation.mutate({ msgId, type })}
                       profile={profile}
                     />
                 ))}
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
      )}
    </div>
  );
};
