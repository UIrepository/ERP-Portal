import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  message: string;
  created_at: string;
  created_by_name: string;
  target_batch: string | null;
  target_subject: string | null;
}

interface StudentAnnouncementsProps {
  batch?: string;
  subject?: string;
  enrolledSubjects?: string[];
}

const AnnouncementSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white border border-[#eaebed] rounded-[4px] p-6 h-[200px] flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <Skeleton className="w-[34px] h-[34px] rounded-full" />
                    <div className="space-y-1">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-2 w-12" />
                    </div>
                </div>
                <Skeleton className="h-5 w-3/4" />
                <div className="space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-full" />
                </div>
            </div>
        ))}
    </div>
);

const AnnouncementCard = ({ announcement }: { announcement: Announcement }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    // Determine if text is potentially long
    const isLong = announcement.message.length > 120 || announcement.message.split('\n').length > 3;

    return (
        <div className="bg-white border border-[#eaebed] rounded-[4px] p-5 hover:border-[#d1d5db] transition-colors duration-200 flex flex-col h-fit">
            {/* Sender Block */}
            <div className="flex items-center gap-3 mb-3.5">
                 {/* Avatar - Clean, no background, perfect fit */}
                 <div className="w-[36px] h-[36px] shrink-0 rounded-full overflow-hidden flex items-center justify-center bg-transparent border border-slate-100">
                     <img 
                        src="https://res.cloudinary.com/dkywjijpv/image/upload/v1769193106/UI_Logo_yiput4.png" 
                        alt="UI" 
                        className="w-full h-full object-contain p-0.5"
                     />
                 </div>
                 <div className="flex flex-col">
                    {/* Main Sender - UI Team (Inter SemiBold) */}
                    <span className="text-[14px] font-semibold text-black font-sans leading-tight">
                        UI Team
                    </span>
                    {/* Meta Info */}
                    <span className="text-[11px] text-[#888888] font-sans mt-0.5">
                        Sent by {announcement.created_by_name || 'Admin'} • {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
                    </span>
                 </div>
            </div>

            {/* Title - Inter SemiBold */}
            <h3 className="text-[15px] font-semibold text-black mb-2 leading-snug tracking-tight">
                {announcement.title}
            </h3>

            {/* Message Content */}
            <div>
                <p className={cn(
                    "text-[13px] text-[#444444] font-normal leading-relaxed whitespace-pre-wrap font-sans transition-all duration-300",
                    !isExpanded && "line-clamp-3"
                )}>
                    {announcement.message}
                </p>
                
                {isLong && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-[11px] font-semibold text-black mt-2 hover:underline flex items-center gap-1 transition-colors"
                    >
                        {isExpanded ? "Read less" : "Read more"}
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                )}
            </div>

            {/* Optional Context Badge */}
            {(announcement.target_subject || announcement.target_batch) && (
                <div className="mt-4 pt-3 border-t border-dashed border-gray-100">
                    <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                         {announcement.target_subject ? `For ${announcement.target_subject}` : 'General Update'}
                    </span>
                </div>
            )}
        </div>
    );
};

export const StudentAnnouncements = ({ batch, subject, enrolledSubjects = [] }: StudentAnnouncementsProps) => {
    
    const { data: announcements, isLoading } = useQuery({
        queryKey: ['student-announcements', batch, subject, enrolledSubjects],
        queryFn: async (): Promise<Announcement[]> => {
            if (!batch && !subject) return [];
            
            let query = supabase
                .from('notifications')
                .select('id, title, message, created_at, created_by_name, target_batch, target_subject');

            if (batch && subject) {
                query = query.or(`and(target_batch.eq.${batch},target_subject.eq.${subject}),and(target_batch.eq.${batch},target_subject.is.null),and(target_batch.is.null,target_subject.eq.${subject}),and(target_batch.is.null,target_subject.is.null)`);
            } else if (batch) {
                let orConditions = [
                    `and(target_batch.is.null,target_subject.is.null)`, 
                    `and(target_batch.eq.${batch},target_subject.is.null)`
                ];

                if (enrolledSubjects.length > 0) {
                    const subjectList = `(${enrolledSubjects.map(s => `"${s}"`).join(',')})`;
                    orConditions.push(`and(target_batch.eq.${batch},target_subject.in.${subjectList})`);
                    orConditions.push(`and(target_batch.is.null,target_subject.in.${subjectList})`);
                }

                query = query.or(orConditions.join(','));
            }

            const { data, error } = await query.order('created_at', { ascending: false });
            
            if (error) throw error;
            return (data || []) as Announcement[];
        },
        enabled: !!batch,
    });

    return (
        <div className="w-full font-sans antialiased">
            {isLoading ? (
                <AnnouncementSkeleton />
            ) : announcements && announcements.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {announcements.map((announcement) => (
                        <AnnouncementCard key={announcement.id} announcement={announcement} />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 bg-white border border-[#eaebed] rounded-[4px]">
                    <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                        <span className="text-lg opacity-50">📭</span>
                    </div>
                    <h3 className="text-sm font-bold text-black">No updates yet</h3>
                    <p className="text-xs text-[#888888] mt-1">Check back later for important announcements.</p>
                </div>
            )}
        </div>
    );
};
