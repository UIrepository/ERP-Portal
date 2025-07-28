
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, ExternalLink, Lock } from 'lucide-react';

interface UIKiPadhaiContent {
  id: string;
  title: string;
  description?: string;
  category?: string;
  link: string;
  is_active: boolean;
  created_at: string;
}

export const StudentUIKiPadhai = () => {
  const { profile } = useAuth();

  const { data: premiumContent } = useQuery({
    queryKey: ['student-ui-ki-padhai'],
    queryFn: async (): Promise<UIKiPadhaiContent[]> => {
      const { data, error } = await (supabase as any)
        .from('ui_ki_padhai_content')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as UIKiPadhaiContent[];
    },
  });

  const handleAccessContent = (content: UIKiPadhaiContent) => {
    // Check if student has premium access
    if (profile?.premium_access) {
      window.open(content.link, '_blank');
    } else {
      // Show premium upgrade message
      alert('Premium access required. Please contact support to upgrade your account.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center">
          <Crown className="mr-2 h-6 w-6 text-yellow-500" />
          UI Ki Padhai - Premium Content
        </h2>
        <Badge variant={profile?.premium_access ? 'default' : 'secondary'}>
          {profile?.premium_access ? 'Premium Access' : 'Standard Access'}
        </Badge>
      </div>

      {!profile?.premium_access && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-5 w-5 text-yellow-600" />
              <h3 className="font-semibold text-yellow-800">Premium Access Required</h3>
            </div>
            <p className="text-sm text-yellow-700">
              Upgrade to premium to access exclusive UI Ki Padhai content, advanced tutorials, and special courses.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {premiumContent && premiumContent.length > 0 ? (
          premiumContent.map((content) => (
            <Card key={content.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Crown className="h-5 w-5 text-yellow-500" />
                      <h3 className="font-semibold">{content.title}</h3>
                      {!profile?.premium_access && (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    {content.description && (
                      <p className="text-sm text-muted-foreground mb-3">{content.description}</p>
                    )}
                    <div className="flex gap-2">
                      <Badge variant="secondary">Premium</Badge>
                      {content.category && (
                        <Badge variant="outline">{content.category}</Badge>
                      )}
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleAccessContent(content)}
                    disabled={!profile?.premium_access}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {profile?.premium_access ? 'Access' : 'Locked'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Crown className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No premium content available at the moment</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
