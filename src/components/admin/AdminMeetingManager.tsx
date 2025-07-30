import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link as LinkIcon, ExternalLink, Copy, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface MeetingLink {
  id: string;
  subject: string;
  batch: string;
  link: string;
}

const LinksSkeleton = () => (
    <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-4">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-5 w-1/3" />
                    </div>
                    <Skeleton className="h-4 w-4/5" />
                    <div className="flex gap-2 justify-end">
                        <Skeleton className="h-9 w-24" />
                        <Skeleton className="h-9 w-24" />
                    </div>
                </div>
            </Card>
        ))}
    </div>
);


export const AdminMeetingManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Set up real-time subscription to the schedules table
  useEffect(() => {
    const channel = supabase
      .channel('realtime-meeting-links-final')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedules' },
        (payload) => {
          // When a change is detected, invalidate the query to refetch the data
          queryClient.invalidateQueries({ queryKey: ['admin-all-meeting-links-final'] });
        }
      )
      .subscribe();

    // Cleanup the subscription when the component unmounts
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch all schedules that have a meeting link
  const { data: meetingLinks = [], isLoading } = useQuery<MeetingLink[]>({
    queryKey: ['admin-all-meeting-links-final'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select('id, subject, batch, link')
        .not('link', 'is', null) // Only get rows where a link exists
        .order('batch, subject');
      
      if (error) {
        // This will show the actual database error in the console
        console.error("Error fetching meeting links:", error);
        throw error;
      };
      return data || [];
    },
  });

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({
      title: 'Link Copied',
      description: 'The meeting link has been copied to your clipboard.',
    });
  };
  
  return (
    <div className="space-y-8 p-6 bg-gray-50/50 min-h-full">
      {/* Header Section */}
      <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            <LinkIcon className="mr-3 h-8 w-8 text-primary" />
            All Meeting Links
          </h1>
          <p className="text-gray-500 mt-1">A complete, real-time list of all class meeting links from the schedules table.</p>
      </div>

      {/* Links List */}
      <div className="space-y-4">
        {isLoading ? (
            <LinksSkeleton />
        ) : meetingLinks.length > 0 ? (
          meetingLinks.map((meeting) => (
            <Card key={meeting.id} className="bg-white">
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center md:justify-between">
                <div className="flex-grow mb-4 md:mb-0">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <LinkIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-800">{meeting.subject}</h3>
                        <Badge variant="secondary" className="mt-1">{meeting.batch}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3 truncate pl-11">
                    {meeting.link}
                  </p>
                </div>
                <div className="flex gap-2 justify-end shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyLink(meeting.link)}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => window.open(meeting.link, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Link
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
            <div className="text-center py-20 bg-white rounded-lg border-dashed border-2">
                <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700">No Meeting Links Found</h3>
                <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                  Either no links exist in the 'schedules' table, or the admin role lacks permission to view them. Please see the next step to fix permissions.
                </p>
            </div>
        )}
      </div>
    </div>
  );
};
