// uirepository/teachgrid-hub/teachgrid-hub-403387c9730ea8d229bbe9118fea5f221ff2dc6c/src/components/student/StudentNotes.tsx
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query'; // Corrected import
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface NotesContent {
  id: string;
  title: string;
  filename: string;
  subject: string;
  batch: string;
  file_url: string;
  tags?: string[];
  created_at: string;
}

interface UserEnrollment {
    batch_name: string;
    subject_name: string;
}

const NotesSkeleton = () => (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {[...Array(3)].map((_, i) => (
      <Card key={i} className="p-4">
        <div className="flex justify-between items-center">
          <div className="space-y-3 flex-grow">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
          <Skeleton className="h-10 w-28" />
        </div>
      </Card>
    ))}
  </div>
);

export const StudentNotes = () => {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');

  // 1. Fetch user's specific enrollments from the new table
  const { data: userEnrollments, isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
    queryKey: ['userEnrollments', profile?.user_id],
    queryFn: async () => {
        if (!profile?.user_id) return [];
        const { data, error } = await supabase
            .from('user_enrollments')
            .select('batch_name, subject_name')
            .eq('user_id', profile.user_id);
        if (error) {
            console.error("Error fetching user enrollments:", error);
            return [];
        }
        return data || [];
    },
    enabled: !!profile?.user_id
  });

  // Extract unique batches and subjects from the fetched enrollments for filter dropdowns
  const availableBatches = useMemo(() => {
    return Array.from(new Set(userEnrollments?.map(e => e.batch_name) || [])).sort();
  }, [userEnrollments]);

  const availableSubjects = useMemo(() => {
    return Array.from(new Set(userEnrollments?.map(e => e.subject_name) || [])).sort();
  }, [userEnrollments]);

  // 2. Fetch Notes content based on specific enrolled combinations and selected filters
  const { data: notes, isLoading: isLoadingNotesContent } = useQuery<NotesContent[]>({
    queryKey: ['student-notes', userEnrollments, selectedBatchFilter, selectedSubjectFilter],
    queryFn: async (): Promise<NotesContent[]> => {
        if (!userEnrollments || userEnrollments.length === 0) return [];

        let query = supabase.from('notes').select('*');

        // Dynamically build OR conditions for each specific enrolled combination
        const combinationFilters = userEnrollments
            .filter(enrollment =>
                (selectedBatchFilter === 'all' || enrollment.batch_name === selectedBatchFilter) &&
                (selectedSubjectFilter === 'all' || enrollment.subject_name === selectedSubjectFilter)
            )
            .map(enrollment => `(batch.eq.${enrollment.batch_name},subject.eq.${enrollment.subject_name})`);

        if (combinationFilters.length > 0) {
            query = query.or(combinationFilters.join(','));
        } else {
            return []; // Return empty if no combinations match filters
        }
        
        query = query.order('created_at', { ascending: false });

        const { data, error } = await query;
      
        if (error) {
            console.error("Error fetching filtered Notes content:", error);
            return [];
        }
        return (data || []) as NotesContent[];
    },
    enabled: !!userEnrollments && userEnrollments.length > 0 // Only run if enrollments are loaded and exist
  });

  // Client-side filtering only for search term
  const filteredNotes = notes?.filter(note => {
    const matchesSearch = !searchTerm || 
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.filename.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const logActivity = async (activityType: string, description: string, metadata?: any) => {
    if (!profile?.user_id) return;
    
    await supabase.from('student_activities').insert({
      user_id: profile.user_id,
      activity_type: activityType,
      description,
      metadata,
      batch: availableBatches.length > 0 ? availableBatches[0] : null,
      subject: metadata.subject,
    });
  };

  const handleDownload = async (note: any) => {
    await logActivity('note_download', `Downloaded ${note.title}`, {
      subject: note.subject,
      noteId: note.id,
      filename: note.filename
    });

    const watermarkText = `${profile?.name} - ${profile?.email}`;
    const watermarkDiv = document.createElement('div');
    watermarkDiv.style.position = 'fixed';
    watermarkDiv.style.top = '50%';
    watermarkDiv.style.left = '50%';
    watermarkDiv.style.transform = 'translate(-50%, -50%) rotate(-45deg)';
    watermarkDiv.style.color = 'rgba(0, 0, 0, 0.1)';
    watermarkDiv.style.fontSize = '4vw';
    watermarkDiv.style.fontWeight = 'bold';
    watermarkDiv.style.pointerEvents = 'none';
    watermarkDiv.style.textAlign = 'center';
    watermarkDiv.style.zIndex = '9999';
    watermarkDiv.textContent = watermarkText;
    document.body.appendChild(watermarkDiv);

    const link = document.createElement('a');
    link.href = note.file_url;
    link.download = note.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      document.body.removeChild(watermarkDiv);
    }, 1000);
  };

  const isLoading = isLoadingEnrollments || isLoadingNotesContent;

  return (
    <div className="p-6 space-y-8 bg-gray-50/50 min-h-full">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            <FileText className="mr-3 h-8 w-8 text-primary" />
            Notes & Resources
          </h1>
          <p className="text-gray-500 mt-1">Download your class notes and materials here.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">Batches: {availableBatches.join(', ')}</Badge>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes by title or filename..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
        <Select value={selectedBatchFilter} onValueChange={setSelectedBatchFilter}>
          <SelectTrigger className="w-48 h-10">
            <SelectValue placeholder="Filter by batch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Batches</SelectItem>
            {availableBatches.map((batch) => (
              <SelectItem key={batch} value={batch}>{batch}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedSubjectFilter} onValueChange={setSelectedSubjectFilter}>
          <SelectTrigger className="w-48 h-10">
            <SelectValue placeholder="Filter by subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {availableSubjects.map((subject) => (
              <SelectItem key={subject} value={subject}>{subject}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notes Grid */}
      <div>
        {isLoading ? (
          <NotesSkeleton />
        ) : filteredNotes && filteredNotes.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredNotes.map((note) => (
              <Card key={note.id} className="bg-white hover:shadow-lg transition-shadow duration-300">
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex-grow">
                    <div className="flex items-start gap-4">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <FileText className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{note.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{note.filename}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      <Badge variant="outline">{note.subject}</Badge>
                      <Badge variant="secondary">{note.batch}</Badge>
                      {note.tags?.map((tag, index) => (
                        <Badge key={index} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                  <Button onClick={() => handleDownload(note)} className="w-full mt-5">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-lg border-dashed border-2">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700">No Notes Found</h3>
            <p className="text-muted-foreground mt-2">Check back later or adjust your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};
