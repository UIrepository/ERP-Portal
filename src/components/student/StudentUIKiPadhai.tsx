import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

import { Badge } from '@/components/ui/badge';
import { Crown, ExternalLink } from 'lucide-react';
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
            <div key={i} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm h-[140px] flex flex-col justify-between">
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


export const StudentUIKiPadhai = ({ batch, subject }: StudentUIKiPadhaiProps) => {
  const { profile } = useAuth();

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
                    onClick={() => handleAccessContent(content)}
                    className="
                        group relative bg-white 
                        border border-slate-200 
                        rounded-lg 
                        p-5 
                        transition-colors duration-200
                        hover:border-black /* Grey default, Black on hover */
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
