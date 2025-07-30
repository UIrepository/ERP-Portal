// uirepository/teachgrid-hub/teachgrid-hub-18fb4b82a0e6ac673de0608908646c2131d885a1/src/components/admin/AdminMeetingManager.tsx
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link as LinkIcon, ExternalLink, Copy, Search, CalendarCheck } from 'lucide-react'; 
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface MeetingLink {
  link: string;
  subject: string;
  batch: string;
}

const LinksSkeleton = () => {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i} className="p-4 rounded-xl">
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
};


export const AdminMeetingManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Set up real-time subscription to the 'meeting_links' table
  useEffect(() => {
    const channel = supabase
      .channel('realtime-meeting-links-admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meeting_links' },
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
        .from('meeting_links')
        .select('link, subject, batch')
        .order('batch, subject');
      
      if (error) {
        console.error("Error fetching from meeting_links table:", error);
        throw error;
      }
      return (data || []) as MeetingLink[];
    },
  });

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({
      title: 'Link Copied',
      description: 'The session link has been copied to your clipboard.',
    });
  };
  
  return (
    <div className="space-y-8 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 min-h-full">
      {/* Header Section - Enhanced Design */}
      <div className="relative p-8 rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white animate-fade-in-up">
        {/* Animated background circles */}
        <div className="absolute -top-16 -left-16 w-48 h-48 bg-white/10 rounded-full animate-pulse-slow"></div>
        <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-white/10 rounded-full animate-pulse-slow animation-delay-500"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white/10 rounded-full animate-pulse-slow animation-delay-1000"></div>

        <div className="relative z-10 text-center">
            <div className="flex items-center justify-center mb-4">
                <CalendarCheck className="h-16 w-16 text-blue-100 drop-shadow-md" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-2 tracking-tight drop-shadow-lg">
                Manage Online Sessions
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 drop-shadow-sm font-semibold">
                Central hub for all class session links.
            </p>
        </div>
      </div>

      {/* Sessions List */}
      <div className="space-y-4">
        {isLoading ? (
            <LinksSkeleton />
        ) : meetingLinks.length > 0 ? (
          meetingLinks.map((meeting) => (
            <Card key={meeting.link} className="bg-white hover:shadow-lg transition-shadow duration-300 rounded-xl">
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center md:justify-between">
                <div className="flex-grow mb-4 md:mb-0">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-full">
                      <LinkIcon className="h-5 w-5 text-blue-600" />
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
                    className="text-blue-700 border-blue-300 hover:bg-blue-50"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => window.open(meeting.link, '_blank')}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Session
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
            <div className="text-center py-20 bg-white rounded-lg border-dashed border-2 shadow-sm">
                <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700">No Online Sessions Found</h3>
                <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                  There are no active online class sessions. Please ensure the 'meeting_links' table is populated and accessible.
                </p>
            </div>
        )}
      </div>
    </div>
  );
};
