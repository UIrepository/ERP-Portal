import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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
                    <Skeleton className="h-3 w-2/3" />
                </div>
            </div>
        ))}
    </div>
);

export const StudentAnnouncements = ({ batch, subject, enrolledSubjects = [] }: StudentAnnouncementsProps) => {
    
    const { data: announcements, isLoading } = useQuery({
        queryKey: ['student-announcements', batch, subject, enrolledSubjects],
        queryFn: async (): Promise<Announcement[]> => {
            if (!batch && !subject) return [];
            
            let query = supabase
                .from('notifications')
                .select('id, title, message, created_at, created_by_name, target_batch, target_subject');

            if (batch && subject) {
                // Specific Subject View
                query = query.or(`and(target_batch.eq.${batch},target_subject.eq.${subject}),and(target_batch.eq.${batch},target_subject.is.null),and(target_batch.is.null,target_subject.eq.${subject}),and(target_batch.is.null,target_subject.is.null)`);
            } else if (batch) {
                // Batch Dashboard View
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
        <div className="max-w-[1200px] mx-auto p-4 md:p-8 bg-[#f8f9fa] min-h-full font-sans antialiased">
            
            {/* Section Header */}
            <div className="mb-8">
                <h1 className="text-[22px] font-bold text-black tracking-tight">Announcements</h1>
            </div>

            {isLoading ? (
                <AnnouncementSkeleton />
            ) : announcements && announcements.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {announcements.map((announcement) => {
                        // Generate initials for avatar (e.g., "Physics Wallah" -> "PW")
                        const authorName = announcement.created_by_name || 'Admin';
                        const initials = authorName
                            .split(' ')
                            .map(n => n[0])
                            .join('')
                            .substring(0, 2)
                            .toUpperCase();

                        return (
                            <div 
                                key={announcement.id} 
                                className="flex flex-col bg-white border border-[#eaebed] rounded-[4px] p-6 hover:border-[#d1d5db] transition-colors duration-200"
                            >
                                {/* Meta Header */}
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="w-[34px] h-[34px] bg-black text-white rounded-full flex items-center justify-center text-[11px] font-bold shrink-0">
                                        {initials}
                                    </div>
                                    <div className="flex flex-col leading-tight">
                                        <span className="text-sm font-semibold text-black">
                                            {authorName}
                                        </span>
                                        <span className="text-xs text-[#888888]">
                                            {formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}
                                        </span>
                                    </div>
                                </div>

                                {/* Content */}
                                <h2 className="text-base font-bold text-black mb-2.5 leading-snug">
                                    {announcement.title}
                                </h2>
                                <p className="text-sm font-normal text-[#444444] leading-relaxed whitespace-pre-wrap">
                                    {announcement.message}
                                </p>
                                
                                {/* Optional Tags (kept subtle) */}
                                {(announcement.target_batch || announcement.target_subject) && (
                                    <div className="mt-4 pt-3 border-t border-dashed border-gray-100 flex gap-2">
                                        {announcement.target_subject && (
                                            <span className="text-[10px] uppercase font-bold text-[#888888] tracking-wider">
                                                {announcement.target_subject}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-white border border-[#eaebed] rounded-[4px]">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <span className="text-xl">📭</span>
                    </div>
                    <h3 className="text-lg font-bold text-black">No updates yet</h3>
                    <p className="text-sm text-[#888888] mt-1">Check back later for important announcements.</p>
                </div>
            )}
        </div>
    );
};
