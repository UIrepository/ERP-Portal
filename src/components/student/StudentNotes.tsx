import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

import { StudentBackButton } from './StudentBackButton';
import { FileText, Download, FileSpreadsheet, FileCode, File } from 'lucide-react';
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

interface StudentNotesProps {
  batch?: string;
  subject?: string;
  onBack?: () => void;
}

// Helper function to determine icon and label based on file type
const getFileMetadata = (url: string, filename: string) => {
  const lowerUrl = url.toLowerCase();
  const lowerName = filename.toLowerCase();

  if (lowerUrl.includes('docs.google.com/spreadsheets') || lowerName.endsWith('.csv') || lowerName.endsWith('.xlsx')) {
    return { 
      icon: <FileSpreadsheet className="w-5 h-5" />, 
      color: "text-green-600", 
      bg: "bg-green-50",
      type: "Spreadsheet",
      ext: "Google Sheets" 
    };
  }
  if (lowerUrl.includes('docs.google.com/document') || lowerName.endsWith('.docx')) {
    return { 
      icon: <FileText className="w-5 h-5" />, 
      color: "text-blue-600", 
      bg: "bg-blue-50",
      type: "Document",
      ext: "Google Docs"
    };
  }
  if (lowerUrl.includes('colab.research.google.com') || lowerName.endsWith('.ipynb')) {
    return { 
      icon: <FileCode className="w-5 h-5" />, 
      color: "text-orange-600", 
      bg: "bg-orange-50",
      type: "Notebook",
      ext: "Google Colab"
    };
  }
  if (lowerUrl.includes('drive.google.com') || lowerName.endsWith('.pdf')) {
    return { 
      icon: <File className="w-5 h-5" />, 
      color: "text-red-600", 
      bg: "bg-red-50",
      type: "PDF File",
      ext: "Portable Document"
    };
  }
  
  // Default
  return { 
    icon: <File className="w-5 h-5" />, 
    color: "text-violet-600", 
    bg: "bg-violet-50",
    type: "Resource",
    ext: "File"
  };
};

const NotesSkeleton = () => (
  <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="bg-white p-4 sm:p-6 rounded-lg border border-slate-100 space-y-4 h-[160px] sm:h-[180px] flex flex-col justify-between">
        <Skeleton className="h-6 w-3/4 rounded-md" />
        <div className="flex justify-between items-end">
           <div className="flex gap-3 items-center">
             <Skeleton className="h-10 w-10 rounded-lg" />
             <div className="space-y-1.5">
               <Skeleton className="h-3 w-20" />
               <Skeleton className="h-2 w-12" />
             </div>
           </div>
           <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>
    ))}
  </div>
);

export const StudentNotes = ({ batch, subject, onBack }: StudentNotesProps) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

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

  return (
    <div className="p-3 sm:p-6 space-y-6 bg-[#fcfcfd] min-h-full font-sans">
      {/* Main Section Holding Container */}
      <div className="bg-white p-4 sm:p-6 md:p-8 rounded-lg">
          {/* Header Section */}
          <div className="mb-6 sm:mb-8 border-b border-slate-100 pb-5 sm:pb-6">
            <div className="flex items-center gap-3">
              {onBack && <StudentBackButton onClick={onBack} />}
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                Reference Section
              </h1>
            </div>
            <p className="text-gray-500 mt-1 text-sm">Course materials and documents</p>
          </div>

          {/* Notes Grid */}
          <div>
            {isLoading ? (
              <NotesSkeleton />
            ) : notes && notes.length > 0 ? (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {notes.map((note) => {
                  const meta = getFileMetadata(note.file_url, note.filename);
                  
                  return (
                    <div
                      key={note.id}
                      className="
                        group relative bg-white
                        border border-slate-200
                        rounded-lg
                        p-4 sm:p-6 flex flex-col justify-between gap-4 sm:gap-6
                        transition-all duration-300
                      "
                    >
                      {/* Title Section (Semi Bold) */}
                      <div>
                        <h3 className="font-semibold text-slate-900 text-lg leading-snug line-clamp-2">
                          {note.title}
                        </h3>
                      </div>

                      {/* Footer Section: Icon/Name Left, Download Right */}
                      <div className="flex items-center justify-between gap-4 pt-2 mt-auto">
                        {/* Left: File Info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`shrink-0 w-11 h-11 rounded-lg flex items-center justify-center ${meta.bg} ${meta.color}`}>
                            {meta.icon}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium text-slate-700 truncate block">
                               {note.filename}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                               {meta.ext}
                            </span>
                          </div>
                        </div>

                        {/* Right: Circular Download Button (Bottom Corner) */}
                        <button 
                          onClick={(e) => handleDownload(e, note)}
                          className="shrink-0 w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-700 hover:scale-105 transition-all duration-300"
                          aria-label="Download"
                        >
                          <Download className="w-5 h-5" />
                        </button>
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
