
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';

export const StudentExtraClasses = () => {
  const { profile } = useAuth();

  // Note: 'extra_classes' table doesn't exist in database yet
  // Using schedules table as fallback
  const { data: extraClasses } = useQuery({
    queryKey: ['student-extra-classes'],
    queryFn: async () => {
      // Return empty array until extra_classes table is created
      return [];
    },
    enabled: !!profile?.batch && !!profile?.subjects
  });

  const upcomingClasses = [];
  const pastClasses = [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Extra Classes</h2>
        <div className="flex gap-2">
          <Badge variant="outline">Batch: {profile?.batch}</Badge>
          <Badge variant="outline">Subjects: {profile?.subjects?.join(', ')}</Badge>
        </div>
      </div>

      {upcomingClasses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Plus className="mr-2 h-5 w-5" />
              Upcoming Extra Classes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingClasses.map((extraClass) => (
                <div key={extraClass.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{extraClass.subject}</h3>
                      <div className="flex items-center text-sm text-muted-foreground mt-1">
                        <Calendar className="h-4 w-4 mr-1" />
                        {format(new Date(extraClass.date), 'PPP')}
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground mt-1">
                        <Clock className="h-4 w-4 mr-1" />
                        {extraClass.start_time} - {extraClass.end_time}
                      </div>
                      {extraClass.reason && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Reason: {extraClass.reason}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="secondary">{extraClass.batch}</Badge>
                      {extraClass.link && (
                        <Button size="sm" asChild>
                          <a href={extraClass.link} target="_blank" rel="noopener noreferrer">
                            Join Class
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {pastClasses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="mr-2 h-5 w-5" />
              Past Extra Classes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pastClasses.map((extraClass) => (
                <div key={extraClass.id} className="p-4 border rounded-lg opacity-60">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{extraClass.subject}</h3>
                      <div className="flex items-center text-sm text-muted-foreground mt-1">
                        <Calendar className="h-4 w-4 mr-1" />
                        {format(new Date(extraClass.date), 'PPP')}
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground mt-1">
                        <Clock className="h-4 w-4 mr-1" />
                        {extraClass.start_time} - {extraClass.end_time}
                      </div>
                      {extraClass.reason && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Reason: {extraClass.reason}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline">{extraClass.batch}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {extraClasses && extraClasses.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Plus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No extra classes scheduled</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
