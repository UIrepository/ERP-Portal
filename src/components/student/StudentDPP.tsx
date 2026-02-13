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
  Target
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DPPContent {
  id: string;
  title: string;
  description?: string;
  difficulty?: string;
  link: string;
  is_active: boolean;
  created_at: string;
  batch: string;
  subject: string;
}

interface StudentDPPProps {
  batch: string;
  subject: string;
}

// Helper function to determine icon and label based on file type/link
const getFileMetadata = (url: string) => {
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('docs.google.com/spreadsheets') || lowerUrl.endsWith('.csv') || lowerUrl.endsWith('.xlsx')) {
    return { 
      icon: <FileSpreadsheet className="w-5 h-5" />, 
      color: "text-green-600", 
      bg: "bg-green-50",
      type: "Spreadsheet",
      ext: "Google Sheets" 
    };
  }
  if (lowerUrl.includes('docs.google.com/document') || lowerUrl.endsWith('.docx')) {
    return { 
      icon: <FileText className="w-5 h-5" />, 
      color: "text-blue-600", 
      bg: "bg-blue-50",
      type: "Document",
      ext: "Google Docs"
    };
  }
  if (lowerUrl.includes('colab.research.google.com') || lowerUrl.endsWith('.ipynb')) {
    return { 
      icon: <FileCode className="w-5 h-5" />, 
      color: "text-orange-600", 
      bg: "bg-orange-50",
      type: "Notebook",
      ext: "Google Colab"
    };
  }
  if (lowerUrl.includes('drive.google.com') || lowerUrl.endsWith('.pdf')) {
    return { 
      icon: <File className="w-5 h-5" />, 
      color: "text-red-600", 
      bg: "bg-red-50",
      type: "PDF File",
      ext: "Portable Document"
    };
  }
  
  // Default for DPP
  return { 
    icon: <Target className="w-5 h-5" />, 
    color: "text-violet-600", 
    bg: "bg-violet-50",
    type: "Problem Set",
    ext: "DPP"
  };
};

const DPPSkeleton = () => (
  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="bg-white p-6 rounded-lg border border-slate-100 space-y-4 h-[180px] flex flex-col justify-between">
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

const DPPViewer = ({ dpp, onBack, onDownload, allDPPs, onDPPSelect }: { dpp: DPPContent, onBack: () => void, onDownload: (dpp: DPPContent) => void, allDPPs: DPPContent[], onDPPSelect: (dpp: DPPContent) => void }) => {
    const otherDPPs = allDPPs.filter(d => d.id !== dpp.id);
  
    return (
      <div className="p-4 md:p-6 space-y-6 bg-slate-50 min-h-full">
        <Button variant="ghost" onClick={onBack} className="mb-4 hover:bg-slate-200">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to DPPs
        </Button>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
                <Card className="bg-white rounded-lg overflow-hidden shadow-sm border-slate-200">
                    <CardHeader className="p-6 border-b bg-white">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-xl font-semibold text-slate-800">{dpp.title}</CardTitle>
                            <Button onClick={() => onDownload(dpp)} variant="outline" size="sm">
                                <Download className="h-4 w-4 mr-2" />
                                Open
                            </Button>
                        </div>
                    </CardHeader>
                    <Alert className="mx-6 mt-4 mb-2 p-3 bg-blue-50 border-blue-100 text-blue-800 text-sm [&>svg]:hidden">
                      <AlertDescription>
                        If content isn't viewing correctly, please use the <strong>Open</strong> button.
                      </AlertDescription>
                    </Alert>
                    <CardContent className="p-0">
                    <div className="w-full h-[60vh] md:h-[75vh] bg-slate-50">
                        <iframe
                        src={dpp.link}
                        className="w-full h-full"
                        title={dpp.title}
                        />
                    </div>
                    </CardContent>
                </Card>
            </div>
            <div className="md:col-span-1">
                <Card className="bg-white rounded-lg shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg">Other DPPs</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {otherDPPs.map(otherDPP => {
                                const meta = getFileMetadata(otherDPP.link);
                                return (
                                <div key={otherDPP.id} className="p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-all duration-200 cursor-pointer flex items-center gap-3" onClick={() => onDPPSelect(otherDPP)}>
                                    <div className={`p-1.5 rounded-md ${meta.bg} ${meta.color}`}>
                                        {meta.icon}
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="font-medium text-sm text-slate-700 truncate">{otherDPP.title}</p>
                                        <p className="text-xs text-slate-400 truncate">{meta.ext}</p>
                                    </div>
                                </div>
                            )})}
                            {otherDPPs.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">No other DPPs available</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
    );
};

export const StudentDPP = ({ batch, subject }: StudentDPPProps) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDPP, setSelectedDPP] = useState<DPPContent | null>(null);

  const { data: dpps, isLoading } = useQuery<DPPContent[]>({
    queryKey: ['student-dpp', batch, subject],
    queryFn: async (): Promise<DPPContent[]> => {
        if (!batch || !subject) return [];
        
        const { data, error } = await supabase
            .from('dpp_content')
            .select('*')
            .eq('batch', batch)
            .eq('subject', subject)
            .eq('is_active', true)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return (data || []) as DPPContent[];
    },
    enabled: !!batch && !!subject
  });

  useEffect(() => {
    if (!profile?.user_id || !batch || !subject) return;

    const dppChannel = supabase
      .channel('dpp-realtime-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dpp_content'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['student-dpp', batch, subject] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(dppChannel);
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

  const handleDownload = async (e: React.MouseEvent, dpp: DPPContent) => {
    e.stopPropagation();
    
    await logActivity('dpp_open', `Opened ${dpp.title}`, {
      subject: dpp.subject,
      dppId: dpp.id,
      link: dpp.link
    });

    window.open(dpp.link, '_blank');
  };

  if (selectedDPP) {
    return <DPPViewer dpp={selectedDPP} onBack={() => setSelectedDPP(null)} onDownload={(d) => handleDownload({ stopPropagation: () => {} } as any, d)} allDPPs={dpps || []} onDPPSelect={setSelectedDPP} />;
  }

  return (
    <div className="p-6 space-y-6 bg-[#fcfcfd] min-h-full font-sans">
      {/* Main Section Holding Container */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 md:p-8 shadow-sm max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="mb-8 border-b border-slate-100 pb-6">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Daily Practice Problems
            </h1>
            <p className="text-gray-500 mt-1 text-sm">Practice sets and assignments</p>
          </div>

          {/* DPP Grid */}
          <div>
            {isLoading ? (
              <DPPSkeleton />
            ) : dpps && dpps.length > 0 ? (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {dpps.map((dpp) => {
                  const meta = getFileMetadata(dpp.link);
                  
                  return (
                    <div 
                      key={dpp.id} 
                      onClick={() => setSelectedDPP(dpp)}
                      className="
                        group relative bg-white 
                        border border-slate-200 
                        rounded-lg
                        p-6 flex flex-col justify-between gap-6
                        hover:bg-slate-50 transition-all duration-300 cursor-pointer
                      "
                    >
                      {/* Title Section (Semi Bold) */}
                      <div>
                        <h3 className="font-semibold text-slate-900 text-lg leading-snug line-clamp-2">
                          {dpp.title}
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
                               {dpp.difficulty || meta.ext}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                               {meta.type}
                            </span>
                          </div>
                        </div>

                        {/* Right: Circular Download Button (Bottom Corner) */}
                        <button 
                          onClick={(e) => handleDownload(e, dpp)}
                          className="shrink-0 w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-700 hover:scale-105 transition-all duration-300"
                          aria-label="Open"
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
                  <Target className="h-8 w-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900">No DPPs Found</h3>
                <p className="text-slate-500 text-sm mt-1">No practice problems have been uploaded yet.</p>
              </div>
            )}
          </div>
      </div>
    </div>
  );
};
