import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, ExternalLink, Search, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

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
    <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-48" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                    </div>
                    <Skeleton className="h-10 w-28" />
                </div>
            </Card>
        ))}
    </div>
);

const PremiumContentViewer = ({ content, onBack, onAccess, allContent, onContentSelect }: { content: UIKiPadhaiContent, onBack: () => void, onAccess: (content: UIKiPadhaiContent) => void, allContent: UIKiPadhaiContent[], onContentSelect: (content: UIKiPadhaiContent) => void }) => {
    const otherContent = allContent.filter(c => c.id !== content.id);

    return (
        <div className="p-4 md:p-6 space-y-6 bg-slate-200 min-h-full">
            <Button variant="outline" onClick={onBack} className="mb-4 bg-white/80 backdrop-blur-sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Premium Content
            </Button>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card className="bg-black rounded-2xl overflow-hidden shadow-2xl">
                         <CardHeader className="p-6 border-b border-yellow-500/30 bg-gray-900">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-white flex items-center gap-3">
                                    <Crown className="text-yellow-400" />
                                    {content.title}
                                </CardTitle>
                                <Button onClick={() => onAccess(content)} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold">
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Access Content
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="w-full h-[60vh] md:h-[75vh]">
                                <iframe
                                    src={content.link}
                                    className="w-full h-full"
                                    title={content.title}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-1">
                     <Card className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-gray-800">
                                <Crown className="text-yellow-500" />
                                More Premium Content
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
                                {otherContent.map(item => (
                                    <div key={item.id} className="p-3 bg-white rounded-lg hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-pointer" onClick={() => onContentSelect(item)}>
                                        <p className="font-semibold text-gray-900">{item.title}</p>
                                        {item.category && (
                                            <Badge variant="outline" className="mt-2">{item.category}</Badge>
                                        )}
                                    </div>
                                ))}
                                {otherContent.length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-4">No other content available</p>
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
  const [searchTerm, setSearchTerm] = useState('');
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

  const filteredContent = useMemo(() => {
    if (!premiumContent) return [];
    return premiumContent.filter(content => 
        content.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (content.description && content.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [premiumContent, searchTerm]);

  const handleAccessContent = (content: UIKiPadhaiContent) => {
    window.open(content.link, '_blank');
  };

  if (selectedContent) {
    return <PremiumContentViewer content={selectedContent} onBack={() => setSelectedContent(null)} onAccess={handleAccessContent} allContent={premiumContent || []} onContentSelect={setSelectedContent} />;
  }

  return (
    <div className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 min-h-full flex flex-col items-center">
      <div className="max-w-4xl mx-auto w-full">
        
        <div className="relative p-8 rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white mb-10 text-center animate-fade-in-up">
            <div className="absolute -top-16 -left-16 w-48 h-48 bg-white/10 rounded-full animate-pulse-slow"></div>
            <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-white/10 rounded-full animate-pulse-slow animation-delay-500"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white/10 rounded-full animate-pulse-slow animation-delay-1000"></div>

            <div className="relative z-10">
                <div className="flex items-center justify-center mb-4">
                    <Crown className="h-16 w-16 text-yellow-100 drop-shadow-md" />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2 tracking-tight drop-shadow-lg">
                    UI Ki Padhai
                </h1>
                <p className="text-xl md:text-2xl text-yellow-100 drop-shadow-sm font-semibold">
                    Exclusive Premium Content for {subject}
                </p>
            </div>
        </div>

        {/* Search Section - No filter dropdowns */}
        <div className="mb-8">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search content..."
              className="pl-10 h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <PremiumContentSkeleton />
          ) : filteredContent && filteredContent.length > 0 ? (
            filteredContent.map((content) => (
                <Card key={content.id} className="bg-white hover:shadow-xl transition-shadow duration-300 group">
                    <CardContent className="p-5 flex flex-col md:flex-row md:items-center md:justify-between">
                        <div className="flex-grow mb-4 md:mb-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-yellow-100 p-2 rounded-full flex-shrink-0">
                                    <Crown className="h-6 w-6 text-yellow-500" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-800 group-hover:text-primary transition-colors">{content.title}</h3>
                                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{content.description}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3 pl-12">
                                {content.category && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{content.category}</Badge>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button 
                                onClick={() => setSelectedContent(content)}
                                variant="outline"
                                className="font-semibold"
                            >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View Content
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))
          ) : (
            <div className="text-center py-20 bg-white rounded-lg border-dashed border-2 shadow-sm">
              <Crown className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700">No Premium Content Available</h3>
              <p className="text-muted-foreground mt-2">No exclusive content is available for this subject yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};