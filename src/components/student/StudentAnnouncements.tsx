import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Megaphone, UserCircle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
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
  enrolledSubjects?: string[]; // New prop to handle batch-level view
}

const AnnouncementSkeleton = () => (
    <div className="space-y-12 relative">
        {[...Array(3)].map((_, i) => (
            <div key={i} className="pl-12 relative">
                <div className="absolute left-3 top-2 h-full w-0.5 bg-slate-200"></div>
                <div className="absolute left-0 top-1">
                    <Skeleton className="w-6 h-6 rounded-full" />
                </div>
                <Card className="bg-white rounded-xl shadow-lg">
                    <CardHeader className="p-5 border-b bg-slate-50">
                        <Skeleton className="h-6 w-3/4 rounded-md" />
                        <Skeleton className="h-4 w-1/2 mt-2 rounded-md" />
                    </CardHeader>
                    <CardContent className="p-6 space-y-3">
                        <Skeleton className="h-4 w-full rounded-md" />
                        <Skeleton className="h-4 w-full rounded-md" />
                        <Skeleton className="h-4 w-5/6 rounded-md" />
                    </CardContent>
                </Card>
            </div>
        ))}
    </div>
);


export const StudentAnnouncements = ({ batch, subject, enrolledSubjects = [] }: StudentAnnouncementsProps) => {
    
    const { data: announcements, isLoading } = useQuery({
        queryKey: ['student-announcements', batch, subject, enrolledSubjects],
        queryFn: async (): Promise<Announcement[]> => {
            // Case 1: No context provided at all (shouldn't happen in this UI, but good safeguard)
            if (!batch && !subject) return [];
            
            let query = supabase
                .from('notifications')
                .select('id, title, message, created_at, created_by_name, target_batch, target_subject');

            if (batch && subject) {
                // Case 2: Specific Subject View (Strict Context)
                // Show: Global, Batch-Global, Subject-Global, or Specific Batch+Subject
                query = query.or(`and(target_batch.eq.${batch},target_subject.eq.${subject}),and(target_batch.eq.${batch},target_subject.is.null),and(target_batch.is.null,target_subject.eq.${subject}),and(target_batch.is.null,target_subject.is.null)`);
            } else if (batch) {
                // Case 3: Batch Dashboard View (Broader Context)
                // Show: 
                // 1. Global (no batch, no subject)
                // 2. Batch General (batch match, no subject)
                // 3. Batch + Enrolled Subject (batch match, subject in enrolled list)
                // 4. Global + Enrolled Subject (no batch, subject in enrolled list)
                
                let orConditions = [
                    `and(target_batch.is.null,target_subject.is.null)`, // Global
                    `and(target_batch.eq.${batch},target_subject.is.null)` // Batch General
                ];

                if (enrolledSubjects.length > 0) {
                    // Format array for Supabase filter: ("Math","Physics")
                    const subjectList = `(${enrolledSubjects.map(s => `"${s}"`).join(',')})`;
                    
                    // Add enrolled subject conditions
                    orConditions.push(`and(target_batch.eq.${batch},target_subject.in.${subjectList})`);
                    orConditions.push(`and(target_batch.is.null,target_subject.in.${subjectList})`);
                }

                query = query.or(orConditions.join(','));
            }

            const { data, error } = await query.order('created_at', { ascending: false });
            
            if (error) {
                console.error("Error fetching announcements:", error);
                throw error;
            }
            return (data || []) as Announcement[];
        },
        // Enable if we have at least a batch
        enabled: !!batch,
    });

    return (
        <div className="p-6 space-y-8 bg-gray-50/50 min-h-full">
            <div>
                <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                    <Megaphone className="mr-3 h-8 w-8 text-primary" />
                    Notice Board
                </h1>
                <p className="text-gray-500 mt-1">
                    {subject ? `Updates for ${subject}` : `Important updates for ${batch}`}
                </p>
            </div>

            <div>
                {isLoading ? (
                    <AnnouncementSkeleton />
                ) : announcements && announcements.length > 0 ? (
                    <div className="relative space-y-12">
                        <div className="absolute left-3 top-2 h-full w-0.5 bg-slate-200" />

                        {announcements.map((announcement) => (
                            <div key={announcement.id} className="relative pl-12">
                                <div className="absolute left-0 top-1">
                                    <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center ring-8 ring-gray-50">
                                        <Megaphone className="h-4 w-4 text-white" />
                                    </div>
                                </div>

                                <Card className="bg-white shadow-lg rounded-xl overflow-hidden hover:shadow-2xl transition-shadow duration-300">
                                    <CardHeader className="p-5 border-b bg-slate-50">
                                        <CardTitle className="text-xl font-bold text-slate-800">{announcement.title}</CardTitle>
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 text-sm text-slate-500 mt-2">
                                            <div className="flex items-center gap-1.5">
                                                <UserCircle className="h-4 w-4"/>
                                                <span>{announcement.created_by_name || 'Admin'}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="h-4 w-4"/>
                                                <span>{format(new Date(announcement.created_at), 'PPP')}</span>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-6">
                                        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{announcement.message}</p>
                                    </CardContent>
                                    {(announcement.target_batch || announcement.target_subject) && (
                                        <div className="px-6 pb-4 flex flex-wrap gap-2">
                                            {announcement.target_batch && <Badge variant="outline">For {announcement.target_batch}</Badge>}
                                            {announcement.target_subject && <Badge variant="secondary">For {announcement.target_subject}</Badge>}
                                        </div>
                                    )}
                                </Card>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white rounded-lg border-dashed border-2 shadow-sm border-slate-300">
                        <div className="inline-block bg-slate-100 rounded-full p-4">
                            <Megaphone className="h-12 w-12 text-slate-400" />
                        </div>
                        <h3 className="mt-6 text-xl font-semibold text-slate-700">No New Announcements</h3>
                        <p className="text-muted-foreground mt-2">Check back later for important updates.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
