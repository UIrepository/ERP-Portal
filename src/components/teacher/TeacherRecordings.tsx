import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Video, Calendar, ExternalLink, PlayCircle, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export const TeacherRecordings = () => {
  const { user } = useAuth();
  
  // Filters state
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

  // 1. Fetch Teacher Profile to get their Assigned Batches and Subjects
  const { data: teacherInfo } = useQuery({
    queryKey: ['teacherInfo', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // 2. Fetch Recordings (Strict Check: Batch AND Subject must match teacher's assignments)
  const { data: recordings, isLoading } = useQuery({
    queryKey: ['teacherRecordings', teacherInfo?.assigned_batches, teacherInfo?.assigned_subjects],
    queryFn: async () => {
      // If teacher has no assignments, return empty
      if (!teacherInfo?.assigned_batches?.length || !teacherInfo?.assigned_subjects?.length) {
        return [];
      }

      // STRICT QUERY: 
      // Teacher must have the Batch assigned AND the Subject assigned to see the recording.
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .in('batch', teacherInfo.assigned_batches)
        .in('subject', teacherInfo.assigned_subjects)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!teacherInfo
  });

  // 3. Client-side Filtering (User selects specific batch/subject from dropdown)
  const filteredRecordings = recordings?.filter(recording => {
    const matchesBatch = selectedBatch === 'all' || recording.batch === selectedBatch;
    const matchesSubject = selectedSubject === 'all' || recording.subject === selectedSubject;
    return matchesBatch && matchesSubject;
  });

  // Helper to clear filters
  const clearFilters = () => {
    setSelectedBatch('all');
    setSelectedSubject('all');
  };

  const hasActiveFilters = selectedBatch !== 'all' || selectedSubject !== 'all';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Generate lists for dropdowns from the teacher's assignments
  const availableBatches = teacherInfo?.assigned_batches || [];
  const availableSubjects = teacherInfo?.assigned_subjects || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">My Recordings</h2>
          <p className="text-muted-foreground">Access recordings for your assigned batches and subjects</p>
        </div>
      </div>

      {/* Filters Section */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-end md:items-center">
            
            {/* Batch Filter */}
            <div className="space-y-2 flex-1 w-full md:w-auto">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Filter className="h-3 w-3" /> Filter by Batch
              </Label>
              <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="All Batches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Batches</SelectItem>
                  {availableBatches.map((batch: string) => (
                    <SelectItem key={batch} value={batch}>{batch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject Filter */}
            <div className="space-y-2 flex-1 w-full md:w-auto">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Filter className="h-3 w-3" /> Filter by Subject
              </Label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {availableSubjects.map((subject: string) => (
                    <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear Button */}
            {hasActiveFilters && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground h-10 px-3"
              >
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!filteredRecordings?.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Recordings Found</h3>
            <p className="text-muted-foreground mt-1 max-w-md mx-auto">
              {hasActiveFilters 
                ? "No recordings match your selected filters. Try changing the Batch or Subject."
                : `We couldn't find any recordings for your assigned Batches (${availableBatches.join(', ')}) and Subjects (${availableSubjects.join(', ')}).`
              }
            </p>
            {hasActiveFilters && (
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                View All My Recordings
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRecordings.map((recording) => (
            <Card key={recording.id} className="hover:shadow-md transition-all group border-l-4 border-l-primary/50 flex flex-col">
              <CardContent className="p-5 flex-1 flex flex-col">
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors shrink-0">
                    <Video className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold line-clamp-2 leading-tight text-base" title={recording.topic}>
                      {recording.topic}
                    </h3>
                  </div>
                </div>

                <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="font-normal text-xs">
                        {recording.subject}
                      </Badge>
                      <Badge variant="outline" className="font-normal text-xs border-primary/20 bg-primary/5">
                        {recording.batch}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(recording.date), 'MMM d, yyyy')}
                    </div>
                </div>
                
                <div className="mt-5 pt-4 border-t">
                    {recording.embed_link ? (
                      <a 
                        href={recording.embed_link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 transition-colors gap-2 group/link"
                      >
                        <PlayCircle className="h-4 w-4" />
                        Watch Video
                        <ExternalLink className="h-3 w-3 opacity-70 group-hover/link:opacity-100 transition-opacity" />
                      </a>
                    ) : (
                        <Button disabled variant="outline" className="w-full">Link Unavailable</Button>
                    )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
