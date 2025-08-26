import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  target_batch: string;
  target_subject: string;
}

const AnnouncementSkeleton = () => (
    <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-5">
                <div className="flex justify-between items-start">
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-72" />
                        <Skeleton className="h-4 w-96" />
                        <Skeleton className="h-4 w-80" />
                    </div>
                    <div className="space-y-2 text-right">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                </div>
            </Card>
        ))}
    </div>
);


export const StudentAnnouncements = () => {
    const { profile } = useAuth();

    const { data: announcements, isLoading } = useQuery<Announcement[]>({
        queryKey: ['student-announcements', profile?.user_id],
        queryFn: async () => {
            if (!profile) return [];
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
        enabled: !!profile?.user_id,
    });

    return (
        <div className="p-6 space-y-8 bg-gray-50/50 min-h-full">
            <div className="relative p-8 rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-r from-primary to-indigo-600 text-white animate-fade-in-up">
                <div className="absolute -top-16 -left-16 w-48 h-48 bg-white/10 rounded-full animate-pulse-slow"></div>
                <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-white/10 rounded-full animate-pulse-slow animation-delay-500"></div>
                <div className="relative z-10 text-center">
                    <div className="flex items-center justify-center mb-4">
                        <Megaphone className="h-16 w-16 text-white drop-shadow-md" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-2 tracking-tight drop-shadow-lg">
                        Announcements
                    </h1>
                    <p className="text-xl md:text-2xl text-indigo-100 drop-shadow-sm font-semibold">
                        Important updates and notices.
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                {isLoading ? (
                    <AnnouncementSkeleton />
                ) : announcements && announcements.length > 0 ? (
                    announcements.map((announcement) => (
                        <Card key={announcement.id} className="bg-white shadow-md rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-primary/20 border-transparent border">
                             <CardHeader className="bg-slate-50 p-4 border-b">
                                <CardTitle className="text-lg font-semibold text-slate-800">{announcement.title}</CardTitle>
                             </CardHeader>
                            <CardContent className="p-6">
                                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{announcement.message}</p>
                            </CardContent>
                            <div className="bg-slate-50 px-6 py-3 border-t flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm text-slate-500 gap-2">
                                <div className="flex items-center gap-2">
                                    <UserCircle className="h-4 w-4"/>
                                    <span>Posted by: <strong>{announcement.created_by_name || 'Admin'}</strong></span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4"/>
                                    <span>{format(new Date(announcement.created_at), 'PPP, p')}</span>
                                </div>
                                {(announcement.target_batch || announcement.target_subject) && (
                                  <div className="flex flex-wrap gap-2">
                                    {announcement.target_batch && <Badge variant="outline">For {announcement.target_batch}</Badge>}
                                    {announcement.target_subject && <Badge variant="secondary">For {announcement.target_subject}</Badge>}
                                  </div>
                                )}
                            </div>
                        </Card>
                    ))
                ) : (
                    <div className="text-center py-20 bg-white rounded-lg border-dashed border-2 shadow-sm">
                        <Megaphone className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-slate-700">No Announcements Found</h3>
                        <p className="text-muted-foreground mt-2">There are no new announcements for you right now.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
