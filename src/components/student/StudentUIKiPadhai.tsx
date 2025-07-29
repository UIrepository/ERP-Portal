import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, ExternalLink, Lock, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface UIKiPadhaiContent {
  id: string;
  title: string;
  description?: string;
  category?: string;
  link: string;
  is_active: boolean;
  created_at: string;
}

const PremiumContentSkeleton = () => (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-5 space-y-4">
                <div className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="w-full space-y-2">
                        <Skeleton className="h-5 w-4/5" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                    </div>
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-20" />
                </div>
                 <Skeleton className="h-10 w-full" />
            </Card>
        ))}
    </div>
);


export const StudentUIKiPadhai = () => {
  const { profile } = useAuth();

  const { data: premiumContent, isLoading } = useQuery({
    queryKey: ['student-ui-ki-padhai'],
    queryFn: async (): Promise<UIKiPadhaiContent[]> => {
      const { data, error } = await supabase
        .from('dpp_content') // Assuming this is the correct table, change if needed
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as UIKiPadhaiContent[];
    },
  });

  const handleAccessContent = (content: UIKiPadhaiContent) => {
    // This logic should be updated based on actual premium access field in profiles
    const hasPremiumAccess = false; // Replace with profile?.premium_access or similar

    if (hasPremiumAccess) {
      window.open(content.link, '_blank');
    } else {
      alert('This is premium content. Please contact an administrator to upgrade your access.');
    }
  };

  return (
    <div className="p-6 space-y-8 bg-gray-50/50 min-h-full">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            <Crown className="mr-3 h-8 w-8 text-yellow-500" />
            UI Ki Padhai
          </h1>
          <p className="text-gray-500 mt-1">Exclusive premium content and advanced courses.</p>
        </div>
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200 text-sm px-4 py-2">
            Premium Content
        </Badge>
      </div>
      
      {/* Premium Banner - Shown if user does not have access */}
      {false && ( // Replace with !profile?.premium_access
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-5 flex items-center gap-4">
                <div className="bg-yellow-100 p-3 rounded-full">
                    <Lock className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                    <h3 className="font-semibold text-yellow-800">Unlock Premium Content</h3>
                    <p className="text-sm text-yellow-700 mt-1">
                        Upgrade your account to access these exclusive courses and materials.
                    </p>
                </div>
            </CardContent>
          </Card>
      )}

      {/* Content Grid */}
      <div>
        {isLoading ? (
          <PremiumContentSkeleton />
        ) : premiumContent && premiumContent.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {premiumContent.map((content) => (
              <Card key={content.id} className="bg-white hover:shadow-lg transition-shadow duration-300 flex flex-col">
                <CardContent className="p-5 flex flex-col flex-grow">
                  <div className="flex-grow">
                    <div className="flex items-start gap-4">
                      <div className="bg-yellow-100 p-2 rounded-full">
                        <Crown className="h-6 w-6 text-yellow-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{content.title}</h3>
                        {content.description && <p className="text-sm text-muted-foreground mt-1">{content.description}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {content.category && (
                        <Badge variant="outline">{content.category}</Badge>
                      )}
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleAccessContent(content)}
                    className="w-full mt-5 bg-yellow-500 hover:bg-yellow-600"
                    >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Access Content
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-lg border-dashed border-2">
            <Crown className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700">No Premium Content Yet</h3>
            <p className="text-muted-foreground mt-2">Exclusive courses and materials will appear here soon.</p>
          </div>
        )}
      </div>
    </div>
  );
};
