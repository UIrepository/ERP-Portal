import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

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
            <div key={i} className="bg-white border border-[#eaebed] rounded-[4px] p-6 h-[220px] flex flex-col gap-4">
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
                    <Skeleton className="h-3 w-full" />
                </div>
            </div>
        ))}
    </div>
);

const AnnouncementCard = ({ announcement }: { announcement: Announcement }) => {
    return (
        <div className="bg-white border border-[#eaebed] rounded-[4px] p-5 hover:border-[#d1d5db] transition-colors duration-200 flex flex-col h-[240px]">
            {/* Sender Block */}
            <div className="flex items-center gap-3 mb-3 shrink-0">
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

            {/* Title */}
            <h3 className="text-[15px] font-semibold text-black mb-2 leading-snug tracking-tight shrink-0">
                {announcement.title}
            </h3>

            {/* Message Content - Scrollable */}
            <div className="flex-1 overflow-y-auto pr-2 min-h-0 custom-scrollbar">
                <p className="text-[13px] text-[#444444] font-normal leading-relaxed whitespace-pre-wrap font-sans">
                    {announcement.message}
                </p>
            </div>

            {/* Optional Context Badge - Fixed at bottom */}
            {(announcement.target_subject || announcement.target_batch) && (
                <div className="mt-3 pt-3 border-t border-dashed border-gray-100 shrink-0">
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
        // Main Container - White Section with reduced rounded corners (rounded-lg)
        <div className="w-full bg-white border border-slate-200 rounded-lg p-6 font-sans antialiased shadow-sm">
            
            {/* Custom scrollbar styling embedded */}
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #e2e8f0;
                    border-radius: 20px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: #cbd5e1;
                }
            `}</style>
            
            {/* Section Title */}
            <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">Notices</h2>
            </div>

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
