
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Clock, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface OngoingClass {
  subject: string;
  batch: string;
  start_time: string;
  end_time: string;
  meeting_link: string;
}

export const StudentCurrentClass = () => {
  const { profile } = useAuth();

  const { data: ongoingClass, isLoading } = useQuery({
    queryKey: ['current-ongoing-class'],
    queryFn: async (): Promise<OngoingClass | null> => {
      const { data, error } = await supabase
        .rpc('get_current_ongoing_class', {
          user_batch: profile?.batch,
          user_subjects: profile?.subjects || []
        });
      
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!profile?.batch && !!profile?.subjects,
    refetchInterval: 30000
  });

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Current Class</h2>
          <p className="text-gray-600">Join your ongoing class session</p>
        </div>

        {ongoingClass ? (
          <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-800 font-semibold text-lg">Live Class in Progress</span>
              </div>
              
              <h3 className="text-3xl font-bold text-green-900 mb-2">
                {ongoingClass.subject}
              </h3>
              
              <div className="flex items-center justify-center gap-6 mb-6 text-green-700">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  <span className="font-medium">
                    {formatTime(ongoingClass.start_time)} - {formatTime(ongoingClass.end_time)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  <Badge variant="outline" className="border-green-300 text-green-800">
                    {ongoingClass.batch}
                  </Badge>
                </div>
              </div>

              {ongoingClass.meeting_link ? (
                <Button 
                  onClick={() => window.open(ongoingClass.meeting_link, '_blank')}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
                  size="lg"
                >
                  <ExternalLink className="h-5 w-5 mr-2" />
                  Join Class Now
                </Button>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800">Meeting link not available</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="mb-6">
                <Clock className="h-16 w-16 mx-auto text-gray-300" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-600 mb-2">
                No Ongoing Class
              </h3>
              <p className="text-gray-500 mb-6">
                You don't have any classes scheduled right now.
              </p>
              <p className="text-sm text-gray-400">
                Check your schedule for upcoming classes.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
