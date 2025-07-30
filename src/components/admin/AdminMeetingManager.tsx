import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link as LinkIcon, ExternalLink, Copy, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');

  const { data: meetingLinks = [], isLoading: isLoadingLinks } = useQuery({
    queryKey: ['admin-all-meeting-links-simple'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select('id, subject, batch, link')
        .not('link', 'is', null)
        .order('batch, subject');
      
      if (error) throw error;
      // Get the last unique link for each subject-batch combo
      const uniqueLinks = Array.from(new Map(data.map(item => [`${item.subject}-${item.batch}`, item])).values());
      return (uniqueLinks || []) as MeetingLink[];
    },
  });
  
  const { data: options = [], isLoading: isLoadingOptions } = useQuery({
      queryKey: ['all-options-central-links'],
      queryFn: async () => {
          const { data, error } = await supabase.rpc('get_all_options');
          if (error) throw error;
          return data || [];
      }
  });

  const { allBatches, allSubjects, filteredLinks } = useMemo(() => {
    const allBatches = Array.from(new Set(options.filter((o: any) => o.type === 'batch').map((o: any) => o.name))).sort();
    const allSubjects = Array.from(new Set(options.filter((o: any) => o.type === 'subject').map((o: any) => o.name))).sort();

    const filtered = meetingLinks.filter(link =>
      (selectedBatch === 'all' || link.batch === selectedBatch) &&
      (selectedSubject === 'all' || link.subject === selectedSubject)
    );
    
    return {
      allBatches,
      allSubjects,
      filteredLinks: filtered,
    };
  }, [meetingLinks, options, selectedBatch, selectedSubject]);

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast({
      title: 'Link Copied',
      description: 'The meeting link has been copied to your clipboard.',
    });
  };
  
  const isLoading = isLoadingLinks || isLoadingOptions;

  return (
    <div className="space-y-8 p-6 bg-gray-50/50 min-h-full">
      {/* Header Section */}
      <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            <LinkIcon className="mr-3 h-8 w-8 text-primary" />
            Meeting Links Overview
          </h1>
          <p className="text-gray-500 mt-1">A complete list of all class meeting links in the system.</p>
        </div>

      {/* Filter Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select value={selectedBatch} onValueChange={setSelectedBatch}>
            <SelectTrigger><SelectValue placeholder="Filter by Batch" /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Batches</SelectItem>
                {allBatches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
        </Select>
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger><SelectValue placeholder="Filter by Subject" /></SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {allSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
        </Select>
      </div>

      {/* Links List */}
      <div className="space-y-4">
        {isLoading ? (
            <LinksSkeleton />
        ) : filteredLinks.length > 0 ? (
          filteredLinks.map((meeting) => (
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
                <p className="text-muted-foreground mt-2">
                  There are no links matching your current filters.
                </p>
            </div>
        )}
      </div>
    </div>
  );
};
