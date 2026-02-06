import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, ExternalLink, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface UIKiPadhaiContent {
  id: string;
  title: string;
  description?: string;
  category?: string;
  link: string;
  is_active: boolean;
  created_at: string;
  batch: string;
  subject: string;
}

interface StudentUIKiPadhaiProps {
  batch?: string;
  subject?: string;
}

const PremiumContentSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white p-5 rounded-lg border border-white shadow-sm h-[140px] flex flex-col justify-between">
                <div className="flex justify-between gap-4">
                    <div className="space-y-3 w-full">
                         <Skeleton className="h-4 w-16 rounded-sm" />
                         <Skeleton className="h-5 w-full" />
                         <Skeleton className="h-5 w-2/3" />
                    </div>
                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                </div>
            </div>
        ))}
    </div>
);

const PremiumContentViewer = ({ content, onBack, onAccess, allContent, onContentSelect }: { content: UIKiPadhaiContent, onBack: () => void, onAccess: (content: UIKiPadhaiContent) => void, allContent: UIKiPadhaiContent[], onContentSelect: (content: UIKiPadhaiContent) => void }) => {
    const otherContent = allContent.filter(c => c.id !== content.id);

    return (
        <div className="p-4 md:p-6 space-y-6 bg-slate-50 min-h-full font-sans">
            <Button variant="ghost" onClick={onBack} className="mb-4 hover:bg-slate-200">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Premium Content
            </Button>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card className="bg-black rounded-lg overflow-hidden shadow-sm border-0">
                         <CardHeader className="p-6 border-b border-white/10 bg-neutral-900">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-white flex items-center gap-3 font-normal">
                                    <Crown className="text-yellow-500 fill-yellow-500" />
                                    {content.title}
                                </CardTitle>
                                <Button onClick={() => onAccess(content)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-full">
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Open Link
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="w-full h-[60vh] md:h-[75vh] bg-neutral-950 flex items-center justify-center">
                                <iframe
                                    src={content.link}
                                    className="w-full h-full"
                                    title={content.title}
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-1">
                     <Card className="bg-white rounded-lg shadow-sm border border-slate-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-gray-900 text-lg font-normal">
                                More Premium Content
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                                {otherContent.map(item => (
                                    <div 
                                        key={item.id} 
                                        className="p-4 bg-white border border-slate-100 rounded-md hover:bg-slate-50 transition-colors duration-200 cursor-pointer group" 
                                        onClick={() => onContentSelect(item)}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <Badge variant="outline" className="bg-yellow-50 text-amber-600 border-yellow-100 text-[10px] uppercase tracking-wider font-bold rounded-sm">
                                                Premium
                                            </Badge>
                                        </div>
                                        <p className="font-normal text-slate-800 transition-colors line-clamp-2">
                                            {item.title}
                                        </p>
                                    </div>
                                ))}
                                {otherContent.length === 0 && (
                                    <p className="text-sm text-slate-400 text-center py-8">No other content available</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export const StudentUIKiPadhai = ({ batch, subject }: StudentUIKiPadhaiProps) => {
  const { profile } = useAuth();
  const [selectedContent, setSelectedContent] = useState<UIKiPadhaiContent | null>(null);

  // Direct query when batch/subject props are provided (context-aware mode)
  const { data: premiumContent, isLoading } = useQuery<UIKiPadhaiContent[]>({
    queryKey: ['student-ui-ki-padhai', batch, subject],
    queryFn: async (): Promise<UIKiPadhaiContent[]> => {
        if (!batch || !subject) return [];
        
        const { data, error } = await supabase
            .from('ui_ki_padhai_content')
            .select('id, title, description, category, link, is_active, created_at, batch, subject')
            .eq('is_active', true)
            .eq('batch', batch)
            .eq('subject', subject)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []) as UIKiPadhaiContent[];
    },
    enabled: !!batch && !!subject
  });

  const handleAccessContent = (content: UIKiPadhaiContent) => {
    window.open(content.link, '_blank');
  };

  if (selectedContent) {
    return <PremiumContentViewer content={selectedContent} onBack={() => setSelectedContent(null)} onAccess={handleAccessContent} allContent={premiumContent || []} onContentSelect={setSelectedContent} />;
  }

  return (
    <div className="p-6 md:p-8 bg-[#fcfcfd] min-h-full font-sans">
      {/* Main Section Holding Container */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 md:p-8 shadow-sm max-w-7xl mx-auto">
        
        {/* Section Header */}
        <header className="flex flex-col md:flex-row justify-between items-end mb-8 border-b border-slate-100 pb-6">
            <div className="mb-2 md:mb-0">
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                    UI Ki Padhai
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Exclusive high-quality resources and premium content.
                </p>
            </div>
        </header>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {isLoading ? (
            <PremiumContentSkeleton />
          ) : premiumContent && premiumContent.length > 0 ? (
            premiumContent.map((content) => (
                <div 
                    key={content.id} 
                    onClick={() => setSelectedContent(content)}
                    className="
                        group relative bg-white 
                        border border-white 
                        rounded-lg 
                        p-5 
                        transition-colors duration-200
                        hover:bg-slate-50 
                        cursor-pointer overflow-hidden
                    "
                >
                    {/* Badge Row */}
                    <div className="mb-3">
                        <div className="inline-flex items-center gap-1.5 bg-[#fffbeb] text-[#f59e0b] text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm border border-[#fef3c7] w-fit">
                            <Crown className="w-3 h-3 fill-current" />
                            Premium
                        </div>
                    </div>

                    {/* Title and Action Button Row */}
                    <div className="flex justify-between items-start gap-4">
                        <h2 className="font-normal text-base text-gray-900 leading-snug tracking-normal line-clamp-3">
                            {content.title}
                        </h2>

                        <button 
                            className="shrink-0 w-9 h-9 rounded-full border-none bg-gray-900 text-white flex items-center justify-center transition-all duration-300 hover:bg-black hover:scale-105"
                            aria-label="View Content"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))
          ) : (
            <div className="col-span-full text-center py-20 bg-white rounded-lg border border-dashed border-slate-200">
              <div className="inline-block bg-slate-50 rounded-full p-4 mb-3">
                <Crown className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">No Premium Content</h3>
              <p className="text-gray-500 text-sm mt-1">Check back later for exclusive updates.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
