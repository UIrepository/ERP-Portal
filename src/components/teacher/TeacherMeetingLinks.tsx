import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link as LinkIcon, ExternalLink, Copy } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface MeetingLink {
  id: string;
  subject: string;
  batch: string;
  link: string;
  created_at: string;
}

const MeetingLinksSkeleton = () => (
    <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
            <Card key={i} className="p-4">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-5 w-1/3" />
                    </div>
                    <Skeleton className="h-4 w-4/5" />
                    <div className="flex gap-2">
                        <Skeleton className="h-9 w-24" />
                        <Skeleton className="h-9 w-24" />
                    </div>
                </div>
            </Card>
        ))}
    </div>
);

export const TeacherMeetingLinks = () => {
  const { profile } = useAuth();
  const batches = Array.isArray(profile?.batch) ? profile.batch : [profile?.batch].filter(Boolean);

  const { data: meetingLinks, isLoading } = useQuery({
    queryKey: ['teacher-meeting-links', batches, profile?.subjects],
    queryFn: async (): Promise<MeetingLink[]> => {
      if (!batches.length || !profile?.subjects) return [];
      const { data, error } = await supabase
        .from('schedules')
        .select('id, subject, batch, link, created_at')
        .in('batch', batches)
        .in('subject', profile.subjects)
        .not('link', 'is', null)
        .order('subject');
      
      if (error) throw error;
      const uniqueLinks = Array.from(new Map(data.map(item => [`${item.subject}-${item.batch}`, item])).values());
      return (uniqueLinks || []) as MeetingLink[];
    },
    enabled: !!profile?.batch && !!profile?.subjects
  });

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({
      title: 'Link Copied',
      description: 'Meeting link has been copied to clipboard',
    });
  };

  const handleJoinMeeting = (link: string) => {
    window.open(link, '_blank');
  };

  return (
    <div className="p-6 space-y-8 bg-gray-50/50 min-h-full">
      {/* Header Section */}
      <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            <LinkIcon className="mr-3 h-8 w-8 text-primary" />
            Your Meeting Links
          </h1>
          <p className="text-gray-500 mt-1">Here are the dedicated meeting links for your assigned courses.</p>
        </div>

      {/* Links List */}
      <div className="space-y-4">
        {isLoading ? (
            <MeetingLinksSkeleton />
        ) : meetingLinks && meetingLinks.length > 0 ? (
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
                  <p className="text-sm text-muted-foreground mt-3 truncate">
                    {meeting.link}
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
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
                    onClick={() => handleJoinMeeting(meeting.link)}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Join
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
            <div className="text-center py-20 bg-white rounded-lg border-dashed border-2">
                <LinkIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700">No Meeting Links Found</h3>
                <p className="text-muted-foreground mt-2">
                Contact the super admin to set up meeting links for your subjects.
                </p>
            </div>
        )}
      </div>
    </div>
  );
};
