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
  // Using 'link' as the unique identifier for rendering and fetching.
  // This matches your confirmed table structure.
  link: string;
  subject: string;
  batch: string;
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

  // Set up real-time subscription to the 'meeting_links' table
  useEffect(() => {
    const channel = supabase
      .channel('realtime-meeting-links-admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meeting_links' }, // Subscribing to 'meeting_links'
        (payload) => {
          console.log(`Real-time update from meeting_links: ${payload.eventType}`);
          queryClient.invalidateQueries({ queryKey: ['admin-meeting-links-from-table'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch all links from the 'meeting_links' table
  const { data: meetingLinks = [], isLoading } = useQuery<MeetingLink[]>({
    queryKey: ['admin-meeting-links-from-table'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_links') // Querying 'meeting_links' table
        // Select ONLY the columns you confirmed are present
        .select('link, subject, batch') 
        .order('batch, subject');
      
      if (error) {
        console.error("Error fetching from meeting_links table:", error);
        throw error;
      };
      // Map data to ensure 'link' is used as the primary key for the component's interface
      return (data || []) as MeetingLink[];
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
            All Meeting Links (meeting_links table) {/* Indicate which table is being used */}
          </h1>
          <p className="text-gray-500 mt-1">A real-time list of all links.</p>
      </div>

      {/* Links List */}
      <div className="space-y-4">
        {isLoading ? (
            <LinksSkeleton />
        ) : meetingLinks.length > 0 ? (
          meetingLinks.map((meeting) => (
            <Card key={meeting.link} className="bg-white hover:shadow-lg transition-shadow duration-300"> {/* Using meeting.link as key */}
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
                  No links available in the 'meeting_links' table, or the admin role lacks permission to view them. Please check the security policy.
                </p>
            </div>
        )}
      </div>
    </div>
  );
};
