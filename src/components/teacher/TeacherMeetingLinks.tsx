
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link, ExternalLink, Copy } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface MeetingLink {
  id: string;
  subject: string;
  batch: string;
  link: string;
  created_at: string;
}

export const TeacherMeetingLinks = () => {
  const { profile } = useAuth();

  const { data: meetingLinks } = useQuery({
    queryKey: ['teacher-meeting-links'],
    queryFn: async (): Promise<MeetingLink[]> => {
      const { data, error } = await (supabase as any)
        .from('meeting_links')
        .select('*')
        .eq('batch', profile?.batch)
        .in('subject', profile?.subjects || [])
        .order('subject');
      
      if (error) throw error;
      return (data || []) as MeetingLink[];
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">🔗 Universal Meeting Links</h2>
        <div className="flex gap-2">
          <Badge variant="outline">Batch: {profile?.batch}</Badge>
          <Badge variant="outline">Subjects: {profile?.subjects?.join(', ')}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Access Your Meeting Links</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            These are your universal meeting links for each subject. Use these links for all your classes.
          </p>
          
          <div className="space-y-4">
            {meetingLinks && meetingLinks.length > 0 ? (
              meetingLinks.map((meeting) => (
                <div key={meeting.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Link className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">{meeting.subject}</h3>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Batch: {meeting.batch}
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="bg-muted px-2 py-1 rounded text-sm flex-1">
                          {meeting.link}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyLink(meeting.link)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleJoinMeeting(meeting.link)}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Join
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Link className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No meeting links set up yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Contact the super admin to set up meeting links for your subjects
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
