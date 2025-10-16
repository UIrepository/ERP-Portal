import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Megaphone, UserCircle, Calendar, Info } from 'lucide-react'; // Added Info icon
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface Announcement {
  id: string;
  title: string;
  message: string;
  created_at: string;
  created_by_name: string;
  target_batch: string;
  target_subject: string;
}

// Interface for enrollment records, needed for the new check
interface UserEnrollment {
    batch_name: string;
    subject_name: string;
}


const AnnouncementSkeleton = () => (
    // ... (skeleton component remains the same)
);


export const StudentAnnouncements = () => {
    const { profile } = useAuth();

    // Step 1: Fetch the user's enrollments first
    const { data: userEnrollments, isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
        queryKey: ['userEnrollmentsForAnnouncements', profile?.user_id],
        queryFn: async () => {
            if (!profile?.user_id) return [];
            const { data, error } = await supabase
                .from('user_enrollments')
                .select('batch_name, subject_name')
                .eq('user_id', profile.user_id);
            if (error) {
                console.error("Error fetching user enrollments:", error);
                return [];
            }
            return data || [];
        },
        enabled: !!profile?.user_id && profile.role === 'student',
    });

    // Step 2: Fetch announcements ONLY if enrollments exist
    const { data: announcements, isLoading: isLoadingAnnouncements } = useQuery<Announcement[]>({
        queryKey: ['student-announcements', profile?.user_id],
        queryFn: async () => {
            // This query now relies on the enrollments check
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error("Error fetching announcements:", error);
                throw error;
            }
            return data || [];
        },
        // Step 3: Enable this query only if the user is a student AND has enrollments
        enabled: !!profile?.user_id && profile.role === 'student' && !!userEnrollments && userEnrollments.length > 0,
    });

    const isLoading = isLoadingEnrollments || isLoadingAnnouncements;

    return (
        <div className="p-6 space-y-8 bg-gray-50/50 min-h-full">
            {/* Header Section */}
            <div>
                <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                    <Megaphone className="mr-3 h-8 w-8 text-primary" />
                    Notice Board
                </h1>
                <p className="text-gray-500 mt-1">All important updates from the team, right here in one place.</p>
            </div>

            {/* Announcements List */}
            <div>
                {isLoading ? (
                    <AnnouncementSkeleton />
                ) : (profile?.role === 'student' && (!userEnrollments || userEnrollments.length === 0)) ? (
                    // Step 4: Show a specific message for students with no enrollments
                    <div className="text-center py-20 bg-white rounded-lg border-dashed border-2 shadow-sm border-slate-300">
                        <div className="inline-block bg-slate-100 rounded-full p-4">
                            <Info className="h-12 w-12 text-slate-400" />
                        </div>
                        <h3 className="mt-6 text-xl font-semibold text-slate-700">No Enrollments Found</h3>
                        <p className="text-muted-foreground mt-2">You are not currently enrolled in any batch. Announcements will appear here once you are enrolled.</p>
                    </div>
                ) : announcements && announcements.length > 0 ? (
                    <div className="relative space-y-12">
                        {/* ... (existing rendering logic for announcements) */}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white rounded-lg border-dashed border-2 shadow-sm border-slate-300">
                         {/* ... (existing "No New Announcements" message) */}
                    </div>
                )}
            </div>
        </div>
    );
};
