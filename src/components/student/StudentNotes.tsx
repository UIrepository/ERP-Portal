import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Download, 
  Search, 
  ArrowLeft, 
  FileSpreadsheet, 
  FileCode, 
  File, 
  Cloud,
  ExternalLink
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
      icon: <FileSpreadsheet className="w-6 h-6" />, 
      color: "text-green-600", 
      bg: "bg-green-50",
      type: "Spreadsheet",
      ext: "Google Sheets" 
    };
  }
  if (lowerUrl.includes('docs.google.com/document') || lowerName.endsWith('.docx')) {
    return { 
      icon: <FileText className="w-6 h-6" />, 
      color: "text-blue-600", 
      bg: "bg-blue-50",
      type: "Document",
      ext: "Google Docs"
    };
  }
  if (lowerUrl.includes('colab.research.google.com') || lowerName.endsWith('.ipynb')) {
    return { 
      icon: <FileCode className="w-6 h-6" />, 
      color: "text-orange-600", 
      bg: "bg-orange-50",
      type: "Notebook",
      ext: "Google Colab"
    };
  }
  if (lowerUrl.includes('drive.google.com') || lowerName.endsWith('.pdf')) {
    return { 
      icon: <File className="w-6 h-6" />, 
      color: "text-red-600", 
      bg: "bg-red-50",
      type: "PDF File",
      ext: "Portable Document"
    };
  }
  
  // Default
  return { 
    icon: <File className="w-6 h-6" />, 
    color: "text-violet-600", 
    bg: "bg-violet-50",
    type: "Resource",
    ext: "File"
  };
};

const NotesSkeleton = () => (
  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="bg-white p-8 rounded-[20px] shadow-sm border border-slate-100 space-y-6 h-[200px]">
        <Skeleton className="h-6 w-3/4 rounded-md" />
        <div className="flex justify-between items-end mt-auto pt-4">
           <div className="flex gap-3">
             <Skeleton className="h-11 w-11 rounded-xl" />
             <div className="space-y-2">
               <Skeleton className="h-3 w-16" />
               <Skeleton className="h-2 w-10" />
             </div>
           </div>
           <Skeleton className="h-12 w-12 rounded-full" />
        </div>
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
          Back to Notes
        </Button>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
                <Card className="bg-white rounded-2xl overflow-hidden shadow-xl border-slate-100">
                    <CardHeader className="p-6 border-b bg-white">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-xl font-semibold text-slate-800">{note.title}</CardTitle>
                            <Button onClick={() => onDownload(note)} className="bg-slate-900 hover:bg-slate-800">
                                <Download className="h-4 w-4 mr-2" />
                                Download
                            </Button>
                        </div>
                    </CardHeader>
                    <Alert className="mx-6 mt-4 mb-2 p-3 bg-blue-50 border-blue-100 text-blue-800 text-sm [&>svg]:hidden">
                      <AlertDescription>
                        For programming subjects, if content isn't viewing correctly, please use the <strong>Download</strong> button.
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
                <Card className="bg-white rounded-2xl shadow-lg border-slate-100">
                    <CardHeader>
                        <CardTitle className="text-lg">Other Files</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {otherNotes.map(otherNote => {
                                const meta = getFileMetadata(otherNote.file_url, otherNote.filename);
                                return (
                                <div key={otherNote.id} className="p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-all duration-200 cursor-pointer flex items-center gap-3" onClick={() => onNoteSelect(otherNote)}>
                                    <div className={`p-2 rounded-lg ${meta.bg} ${meta.color}`}>
                                        {meta.icon}
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="font-medium text-sm text-slate-700 truncate">{otherNote.title}</p>
                                        <p className="text-[11px] text-slate-400 uppercase">{meta.ext}</p>
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

  // Client-side filtering
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

  const handleDownload = async (e: React.MouseEvent, note: NotesContent) => {
    e.stopPropagation(); // Prevent card click when clicking download
    
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
    <div className="p-6 space-y-8 bg-[#fcfcfd] min-h-full font-sans">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center tracking-tight">
          <FileText className="mr-3 h-8 w-8 text-violet-600" />
          Notes & Resources
        </h1>
        <p className="text-gray-500 mt-2 text-lg">Download your class notes and materials for {subject}</p>
      </div>

      {/* Search Section */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-violet-600 transition-colors" />
          <Input
            placeholder="Search notes by title or filename..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-11 bg-white border-gray-200 focus:border-violet-600 focus:ring-violet-600/20 rounded-xl transition-all"
          />
        </div>
      </div>

      {/* Notes Grid */}
      <div>
        {isLoading ? (
          <NotesSkeleton />
        ) : filteredNotes && filteredNotes.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredNotes.map((note) => {
              const meta = getFileMetadata(note.file_url, note.filename);
              
              return (
                <div 
                  key={note.id} 
                  onClick={() => setSelectedNote(note)}
                  className="bg-white p-8 rounded-[20px] shadow-[0_1px_2px_rgba(0,0,0,0.02),0_4px_12px_rgba(0,0,0,0.03),0_12px_24px_-4px_rgba(0,0,0,0.04)] border border-black/5 transition-all duration-400 cursor-pointer hover:-translate-y-1.5 hover:shadow-[0_4px_6px_rgba(0,0,0,0.02),0_20px_40px_-8px_rgba(0,0,0,0.08)] hover:border-violet-600/10 relative group h-full flex flex-col justify-between"
                >
                  <div>
                    <h3 className="mb-6 text-xl font-semibold leading-relaxed text-gray-900 tracking-tight line-clamp-2">
                      {note.title}
                    </h3>
                  </div>

                  <div className="flex justify-between items-center mt-auto">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${meta.bg} ${meta.color}`}>
                        {meta.icon}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[13px] font-semibold text-gray-900">
                          {meta.type}
                        </span>
                        <span className="text-[11px] text-gray-500 uppercase tracking-wider">
                          {meta.ext}
                        </span>
                      </div>
                    </div>

                    <button 
                      onClick={(e) => handleDownload(e, note)}
                      className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center transition-all duration-300 border-none cursor-pointer shadow-lg hover:bg-violet-600 hover:scale-105 group-hover:shadow-violet-600/20"
                      aria-label="Download Now"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-[20px] border border-dashed border-slate-200">
            <div className="inline-block bg-slate-50 rounded-2xl p-6 mb-4">
              <FileText className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900">No Notes Found</h3>
            <p className="text-slate-500 mt-2">No notes are available for this subject yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};
