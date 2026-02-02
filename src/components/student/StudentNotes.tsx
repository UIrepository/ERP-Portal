import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Search, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

interface StudentNotesProps {
  batch?: string;
  subject?: string;
}

const NotesSkeleton = () => (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {[...Array(3)].map((_, i) => (
      <Card key={i} className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="w-full space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-20" />
        </div>
      </Card>
    ))}
  </div>
);

const NoteViewer = ({ note, onBack, onDownload, allNotes, onNoteSelect }: { note: NotesContent, onBack: () => void, onDownload: (note: NotesContent) => void, allNotes: NotesContent[], onNoteSelect: (note: NotesContent) => void }) => {
    const otherNotes = allNotes.filter(n => n.id !== note.id);
  
    return (
      <div className="p-4 md:p-6 space-y-6 bg-slate-100 min-h-full">
        <Button variant="outline" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Notes
        </Button>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
                <Card className="bg-white rounded-2xl overflow-hidden shadow-2xl">
                    <CardHeader className="p-6 border-b">
                        <div className="flex justify-between items-center">
                            <CardTitle>{note.title}</CardTitle>
                            <Button onClick={() => onDownload(note)}>
                                <Download className="h-4 w-4 mr-2" />
                                Download
                            </Button>
                        </div>
                    </CardHeader>
                    <Alert className="mx-4 mb-2 p-3 bg-blue-50 border-blue-200 text-blue-800 text-sm [&>svg]:hidden">
                      <AlertDescription>
                        For programming subjects, if content isn't viewing correctly, please use the <strong>Download</strong> button.
                      </AlertDescription>
                    </Alert>
                    <CardContent className="p-0">
                    <div className="w-full h-[60vh] md:h-[75vh]">
                        <iframe
                        src={note.file_url}
                        className="w-full h-full"
                        title={note.title}
                        />
                    </div>
                    </CardContent>
                </Card>
            </div>
            <div className="md:col-span-1">
                <Card className="bg-white rounded-2xl shadow-2xl">
                    <CardHeader>
                        <CardTitle>Other Files</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {otherNotes.map(otherNote => (
                                <div key={otherNote.id} className="p-3 border rounded-lg hover:shadow-md hover:border-primary/50 transition-all duration-200 cursor-pointer" onClick={() => onNoteSelect(otherNote)}>
                                    <p className="font-semibold text-primary">{otherNote.title}</p>
                                    <p className="text-xs text-muted-foreground">{otherNote.filename}</p>
                                </div>
                            ))}
                            {otherNotes.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">No other notes available</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    );
  };


export const StudentNotes = ({ batch, subject }: StudentNotesProps) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNote, setSelectedNote] = useState<NotesContent | null>(null);

  // Direct query when batch/subject props are provided (context-aware mode)
  const { data: notes, isLoading } = useQuery<NotesContent[]>({
    queryKey: ['student-notes', batch, subject],
    queryFn: async (): Promise<NotesContent[]> => {
        if (!batch || !subject) return [];
        
        const { data, error } = await supabase
            .from('notes')
            .select('*')
            .eq('batch', batch)
            .eq('subject', subject)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return (data || []) as NotesContent[];
    },
    enabled: !!batch && !!subject
  });

  // Set up real-time subscriptions for notes data
  useEffect(() => {
    if (!profile?.user_id || !batch || !subject) return;

    const notesChannel = supabase
      .channel('notes-realtime-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes'
        },
        () => {
          console.log('Real-time update: notes changed');
          queryClient.invalidateQueries({ queryKey: ['student-notes', batch, subject] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notesChannel);
    };
  }, [profile?.user_id, batch, subject, queryClient]);

  // Client-side filtering only for search term
  const filteredNotes = useMemo(() => {
    if (!notes) return [];
    return notes.filter(note => {
      const matchesSearch = !searchTerm || 
        note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.filename.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [notes, searchTerm]);

  const logActivity = async (activityType: string, description: string, metadata?: any) => {
    if (!profile?.user_id) return;
    
    await supabase.from('student_activities').insert({
      user_id: profile.user_id,
      activity_type: activityType,
      description,
      metadata,
      batch: batch || null,
      subject: subject || null,
    });
  };

  const handleDownload = async (note: NotesContent) => {
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

  if (selectedNote) {
    return <NoteViewer note={selectedNote} onBack={() => setSelectedNote(null)} onDownload={handleDownload} allNotes={notes || []} onNoteSelect={setSelectedNote} />;
  }

  return (
    <div className="p-6 space-y-8 bg-gray-50/50 min-h-full">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800 flex items-center">
          <FileText className="mr-3 h-8 w-8 text-primary" />
          Notes & Resources
        </h1>
        <p className="text-gray-500 mt-1">Download your class notes and materials for {subject}</p>
      </div>

      {/* Search Section - No filter dropdowns */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes by title or filename..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
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
                      {note.tags?.map((tag, index) => (
                        <Badge key={index} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                  <Button onClick={() => setSelectedNote(note)} className="w-full mt-5">
                    <FileText className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-lg border-dashed border-2 shadow-sm border-slate-300">
            <div className="inline-block bg-slate-100 rounded-full p-4">
              <FileText className="h-12 w-12 text-slate-400" />
            </div>
            <h3 className="mt-6 text-xl font-semibold text-slate-700">No Notes Found</h3>
            <p className="text-muted-foreground mt-2">No notes are available for this subject yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};