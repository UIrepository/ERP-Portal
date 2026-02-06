import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Download, 
  ArrowLeft, 
  FileSpreadsheet, 
  FileCode, 
  File,
  Eye
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
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

// Helper function to determine icon and label based on file type
const getFileMetadata = (url: string, filename: string) => {
  const lowerUrl = url.toLowerCase();
  const lowerName = filename.toLowerCase();

  if (lowerUrl.includes('docs.google.com/spreadsheets') || lowerName.endsWith('.csv') || lowerName.endsWith('.xlsx')) {
    return { 
      icon: <FileSpreadsheet className="w-4 h-4" />, 
      color: "text-green-600", 
      bg: "bg-green-50",
      type: "Spreadsheet",
      ext: "Google Sheets" 
    };
  }
  if (lowerUrl.includes('docs.google.com/document') || lowerName.endsWith('.docx')) {
    return { 
      icon: <FileText className="w-4 h-4" />, 
      color: "text-blue-600", 
      bg: "bg-blue-50",
      type: "Document",
      ext: "Google Docs"
    };
  }
  if (lowerUrl.includes('colab.research.google.com') || lowerName.endsWith('.ipynb')) {
    return { 
      icon: <FileCode className="w-4 h-4" />, 
      color: "text-orange-600", 
      bg: "bg-orange-50",
      type: "Notebook",
      ext: "Google Colab"
    };
  }
  if (lowerUrl.includes('drive.google.com') || lowerName.endsWith('.pdf')) {
    return { 
      icon: <File className="w-4 h-4" />, 
      color: "text-red-600", 
      bg: "bg-red-50",
      type: "PDF File",
      ext: "Portable Document"
    };
  }
  
  // Default
  return { 
    icon: <File className="w-4 h-4" />, 
    color: "text-violet-600", 
    bg: "bg-violet-50",
    type: "Resource",
    ext: "File"
  };
};

const NotesSkeleton = () => (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="bg-white p-4 rounded-lg border border-slate-200 space-y-3">
        <Skeleton className="h-5 w-3/4 rounded-md" />
        <div className="flex items-center gap-2">
           <Skeleton className="h-4 w-4 rounded" />
           <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-9 w-full rounded-md mt-2" />
      </div>
    ))}
  </div>
);

const NoteViewer = ({ note, onBack, onDownload, allNotes, onNoteSelect }: { note: NotesContent, onBack: () => void, onDownload: (note: NotesContent) => void, allNotes: NotesContent[], onNoteSelect: (note: NotesContent) => void }) => {
    const otherNotes = allNotes.filter(n => n.id !== note.id);
  
    return (
      <div className="p-4 md:p-6 space-y-6 bg-slate-50 min-h-full">
        <Button variant="ghost" onClick={onBack} className="mb-4 hover:bg-slate-200">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to References
        </Button>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
                <Card className="bg-white rounded-xl overflow-hidden shadow-sm border-slate-200">
                    <CardHeader className="p-6 border-b bg-white">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-xl font-semibold text-slate-800">{note.title}</CardTitle>
                            <Button onClick={() => onDownload(note)} variant="outline" size="sm">
                                <Download className="h-4 w-4 mr-2" />
                                Download
                            </Button>
                        </div>
                    </CardHeader>
                    <Alert className="mx-6 mt-4 mb-2 p-3 bg-blue-50 border-blue-100 text-blue-800 text-sm [&>svg]:hidden">
                      <AlertDescription>
                        If content isn't viewing correctly, please use the <strong>Download</strong> button.
                      </AlertDescription>
                    </Alert>
                    <CardContent className="p-0">
                    <div className="w-full h-[60vh] md:h-[75vh] bg-slate-50">
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
                <Card className="bg-white rounded-xl shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg">Other Files</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {otherNotes.map(otherNote => {
                                const meta = getFileMetadata(otherNote.file_url, otherNote.filename);
                                return (
                                <div key={otherNote.id} className="p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-all duration-200 cursor-pointer flex items-center gap-3" onClick={() => onNoteSelect(otherNote)}>
                                    <div className={`p-1.5 rounded-md ${meta.bg} ${meta.color}`}>
                                        {meta.icon}
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="font-medium text-sm text-slate-700 truncate">{otherNote.title}</p>
                                        <p className="text-xs text-slate-400 truncate">{otherNote.filename}</p>
                                    </div>
                                </div>
                            )})}
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
  const [selectedNote, setSelectedNote] = useState<NotesContent | null>(null);

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
          queryClient.invalidateQueries({ queryKey: ['student-notes', batch, subject] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notesChannel);
    };
  }, [profile?.user_id, batch, subject, queryClient]);

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

  const handleDownload = async (e: React.MouseEvent, note: NotesContent) => {
    e.stopPropagation();
    
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
    return <NoteViewer note={selectedNote} onBack={() => setSelectedNote(null)} onDownload={(n) => handleDownload({ stopPropagation: () => {} } as any, n)} allNotes={notes || []} onNoteSelect={setSelectedNote} />;
  }

  return (
    <div className="p-6 space-y-6 bg-[#fcfcfd] min-h-full font-sans">
      {/* Main Section Holding Container */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="mb-8 border-b border-slate-100 pb-6">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Reference Section
            </h1>
            <p className="text-gray-500 mt-1 text-sm">Course materials and documents</p>
          </div>

          {/* Notes Grid */}
          <div>
            {isLoading ? (
              <NotesSkeleton />
            ) : notes && notes.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {notes.map((note) => {
                  const meta = getFileMetadata(note.file_url, note.filename);
                  
                  return (
                    <div 
                      key={note.id} 
                      className="
                        group relative bg-white 
                        border border-slate-200 
                        rounded-lg 
                        shadow-none 
                        hover:bg-slate-50 transition-colors 
                        p-4 flex flex-col gap-4
                      "
                    >
                      {/* Top Row: Title and Circular Download Button */}
                      <div className="flex justify-between items-start gap-3">
                        <h3 className="font-medium text-slate-900 line-clamp-2 text-base leading-snug pt-1">
                          {note.title}
                        </h3>
                        
                        {/* Circular Download Button (Premium Style) */}
                        <button 
                          onClick={(e) => handleDownload(e, note)}
                          className="shrink-0 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center transition-transform hover:scale-105 hover:bg-slate-700 shadow-sm"
                          aria-label="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>

                      {/* File Info Row */}
                      <div className="flex items-center gap-2.5 text-slate-500">
                        <div className={`${meta.color} shrink-0`}>
                          {meta.icon}
                        </div>
                        <span className="text-xs truncate font-normal text-slate-500 max-w-full">
                          {note.filename}
                        </span>
                      </div>

                      {/* View Note Button */}
                      <div className="mt-auto pt-2">
                        <Button 
                          className="w-full bg-slate-100 text-slate-900 hover:bg-slate-200 border border-slate-200 shadow-sm"
                          size="sm"
                          onClick={() => setSelectedNote(note)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-2" />
                          View Note
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="inline-block bg-slate-50 rounded-full p-4 mb-3">
                  <FileText className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900">No References Found</h3>
                <p className="text-slate-500 text-sm mt-1">No materials have been uploaded yet.</p>
              </div>
            )}
          </div>
      </div>
    </div>
  );
};
