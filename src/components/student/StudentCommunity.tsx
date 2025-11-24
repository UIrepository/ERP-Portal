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
  Lock,
  Megaphone
} from 'lucide-react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
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
  is_priority: boolean; // New Field
  profiles: { name: string } | null;
  message_likes: { user_id: string; reaction_type: string }[]; 
}

interface UserEnrollment {
  batch_name: string;
  subject_name: string;
}

// --- Helper for Avatar Colors ---
const getAvatarColor = (name: string) => {
  const colors = ['bg-red-100 text-red-700', 'bg-green-100 text-green-700', 'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-yellow-100 text-yellow-700', 'bg-pink-100 text-pink-700'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// --- Swipeable Message Component ---
const MessageItem = ({ 
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
    // New logic: Check if the message was deleted by the sender (You) or a moderator (Admin)
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

  // Priority Styles
  const priorityClass = msg.is_priority 
    ? "bg-rose-50 border-2 border-rose-200 text-rose-900 shadow-md" 
    : isMe 
      ? "bg-teal-700 text-white" 
      : "bg-white text-gray-800 border border-gray-200";

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
               className={`mb-2 rounded-md ${replyBg} border-l-4
