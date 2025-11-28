import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { History, UserCircle, Calendar, Trash2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';

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

export const AdminAnnouncementsViewer = () => {
    const queryClient = useQueryClient();

    const { data: announcements, isLoading } = useQuery<Announcement[]>({
        queryKey: ['admin-all-announcements'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('notifications')
                .select('id, title, message, created_at, created_by_name, target_batch, target_subject')
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error("Error fetching announcements:", error);
                throw error;
            }
            return data || [];
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('notifications').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: "Success", description: "Announcement deleted." });
            queryClient.invalidateQueries({ queryKey: ['admin-all-announcements'] });
        },
        onError: (error: any) => {
            toast({ title: "Error", description: `Failed to delete announcement: ${error.message}`, variant: "destructive" });
        }
    });

    return (
        <div className="p-6 space-y-8 bg-gray-50/50 min-h-full">
            <div>
                <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                    <History className="mr-3 h-8 w-8 text-primary" />
                    Sent Announcements
                </h1>
                <p className="text-gray-500 mt-1">A log of all past announcements.</p>
            </div>

            <div className="space-y-6">
                {isLoading ? (
                    <AnnouncementSkeleton />
                ) : announcements && announcements.length > 0 ? (
                    announcements.map((announcement) => (
                        <Card key={announcement.id} className="bg-white shadow-md rounded-xl overflow-hidden">
                             <CardHeader className="bg-slate-50 p-4 border-b flex flex-row justify-between items-center">
                                <CardTitle className="text-lg font-semibold text-slate-800">{announcement.title}</CardTitle>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm">
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Delete
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. This will permanently delete the announcement.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => deleteMutation.mutate(announcement.id)}>
                                                Continue
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                             </CardHeader>
                            <CardContent className="p-6">
                                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{announcement.message}</p>
                            </CardContent>
                            <div className="bg-slate-50 px-6 py-3 border-t flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm text-slate-500 gap-2">
                                <div className="flex items-center gap-2">
                                    <UserCircle className="h-4 w-4"/>
                                    <span>By: <strong>{announcement.created_by_name || 'Admin'}</strong></span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4"/>
                                    <span>{format(new Date(announcement.created_at), 'PPP, p')}</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline">To: {announcement.target_batch || 'All Batches'}</Badge>
                                    <Badge variant="secondary">Re: {announcement.target_subject || 'All Subjects'}</Badge>
                                </div>
                            </div>
                        </Card>
                    ))
                ) : (
                    <div className="text-center py-20 bg-white rounded-lg border-dashed border-2 shadow-sm">
                        <History className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-slate-700">No Announcements Sent</h3>
                        <p className="text-muted-foreground mt-2">Use the "Create Announcement" tab to send your first message.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
