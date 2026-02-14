import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Bell, Check, Trash2, X, MessageSquare, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  type: 'message' | 'announcement' | 'feedback'; // Added 'feedback' type
  link?: string;
}

// Helper to clean array strings
const cleanList = (raw: any): string[] => {
  if (!raw) return [];
  let list: any[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
      else list = [raw];
    } catch {
      list = raw.split(',').map(s => s.trim());
    }
  }
  return list.map(s => String(s).replace(/[\[\]"']/g, '').trim()).filter(s => s);
};

export const NotificationCenter = () => {
  const { profile, resolvedRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Load read state from local storage on mount
  useEffect(() => {
    const stored = localStorage.getItem('read_notifications');
    if (stored) {
      setReadIds(new Set(JSON.parse(stored)));
    }
  }, []);

  // Persist read state
  useEffect(() => {
    localStorage.setItem('read_notifications', JSON.stringify(Array.from(readIds)));
  }, [readIds]);

  // --- 1. Fetch Standard Notifications (Chats, etc.) ---
  const { data: standardNotifications = [] } = useQuery({
    queryKey: ['notifications-standard', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      
      // Fetch unread Direct Messages (last 20)
      const { data: dms, error: dmError } = await supabase
        .from('direct_messages')
        .select('id, content, created_at, sender_id')
        .eq('receiver_id', profile.user_id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (dmError) throw dmError;

      // Fetch sender names separately since there's no FK relationship
      const senderIds = [...new Set((dms || []).map(dm => dm.sender_id))];
      const { data: senderProfiles } = senderIds.length > 0
        ? await supabase.from('profiles').select('user_id, name').in('user_id', senderIds)
        : { data: [] };
      const senderMap = new Map((senderProfiles || []).map(p => [p.user_id, p.name]));

      return (dms || []).map(dm => ({
        id: `dm-${dm.id}`,
        title: senderMap.get(dm.sender_id) || 'New Message',
        message: dm.content,
        created_at: dm.created_at,
        read: false,
        type: 'message' as const
      }));
    },
    enabled: !!profile?.user_id,
    refetchInterval: 10000, 
  });

  // --- 2. Fetch Feedback Notifications (Only for Teachers) ---
  const { data: feedbackNotifications = [] } = useQuery({
    queryKey: ['notifications-feedback', profile?.user_id],
    queryFn: async () => {
        if (resolvedRole !== 'teacher' || !profile?.user_id) return [];

        // Get teacher assignments
        const { data: teacher, error: teacherError } = await supabase
            .from('teachers')
            .select('assigned_batches, assigned_subjects')
            .eq('user_id', profile.user_id)
            .single();
        
        if (teacherError || !teacher) return [];

        const batches = cleanList(teacher.assigned_batches);
        const subjects = cleanList(teacher.assigned_subjects);

        if (batches.length === 0 || subjects.length === 0) return [];

        // Get recent feedback (last 3 days to keep it relevant)
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const { data: feedback, error: feedbackError } = await supabase
            .from('feedback')
            .select('*')
            .in('batch', batches)
            .in('subject', subjects)
            .gte('created_at', threeDaysAgo.toISOString())
            .order('created_at', { ascending: false });

        if (feedbackError) throw feedbackError;

        return (feedback || []).map(f => ({
            id: `feedback-${f.id}`,
            title: `New Feedback: ${f.subject}`,
            message: `${f.teacher_quality}/5 stars - ${f.comments ? f.comments.substring(0, 40) + '...' : 'No comment'}`,
            created_at: f.created_at,
            read: false,
            type: 'feedback' as const
        }));
    },
    enabled: !!profile?.user_id && resolvedRole === 'teacher',
    refetchInterval: 30000,
  });

  // Combine and Sort
  const allNotifications: NotificationItem[] = useMemo(() => {
    const combined = [...standardNotifications, ...feedbackNotifications];
    return combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [standardNotifications, feedbackNotifications]);

  // Filter out locally dismissed/read items
  const activeNotifications = allNotifications.filter(n => !readIds.has(n.id));
  const unreadCount = activeNotifications.length;

  const markAsRead = (id: string) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    // Optional: Mark as read in DB if it's a DM (requires separate mutation)
  };

  const markAllRead = () => {
    const newReadIds = new Set(readIds);
    activeNotifications.forEach(n => newReadIds.add(n.id));
    setReadIds(newReadIds);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-gray-500 hover:text-gray-700 hover:bg-slate-100 transition-colors">
          <Bell className={cn("h-5 w-5", unreadCount > 0 && "text-slate-800")} />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 mr-4 shadow-xl border-slate-200" align="end">
        <div className="flex items-center justify-between p-3 border-b bg-slate-50/50">
          <h4 className="font-semibold text-sm text-slate-700">Notifications</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="h-6 text-xs text-blue-600 hover:text-blue-800 px-2">
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[350px]">
          <div className="flex flex-col">
            <AnimatePresence initial={false}>
              {activeNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                  <Bell className="h-10 w-10 mb-2 opacity-20" />
                  <p className="text-sm">No new notifications</p>
                </div>
              ) : (
                activeNotifications.map((notification) => (
                  <motion.div
                    key={notification.id}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0, marginLeft: -300 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                        "relative group flex gap-3 p-3 border-b last:border-0 hover:bg-slate-50 transition-colors cursor-default",
                        // MUD LIGHT COLOR for Feedback
                        notification.type === 'feedback' ? "bg-[#f5f0e1] hover:bg-[#ede6d4]" : "bg-white"
                    )}
                  >
                    <div className="mt-1 shrink-0">
                        {notification.type === 'feedback' ? (
                            <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-700">
                                <Star className="h-4 w-4 fill-yellow-600" />
                            </div>
                        ) : (
                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                <MessageSquare className="h-4 w-4" />
                            </div>
                        )}
                    </div>
                    
                    <div className="flex-1 space-y-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={cn("text-sm font-medium truncate", notification.type === 'feedback' ? "text-[#5c4d3c]" : "text-slate-900")}>
                            {notification.title}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {format(new Date(notification.created_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      <p className={cn("text-xs line-clamp-2", notification.type === 'feedback' ? "text-[#7a6a57]" : "text-slate-500")}>
                        {notification.message}
                      </p>
                    </div>

                    {/* Quick Dismiss Action on Hover (Desktop) or Tap (Mobile) */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity absolute top-1 right-1 text-slate-400 hover:text-red-500 hover:bg-transparent"
                        onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                        }}
                    >
                        <X className="h-3 w-3" />
                    </Button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
