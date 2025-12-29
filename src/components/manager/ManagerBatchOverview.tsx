import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, BookOpen, Calendar, Video } from 'lucide-react';

export const ManagerBatchOverview = () => {
  const { user } = useAuth();

  const { data: managerInfo } = useQuery({
    queryKey: ['managerInfo', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('managers')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ['managerBatchStats', managerInfo?.assigned_batches],
    queryFn: async () => {
      if (!managerInfo?.assigned_batches?.length) {
        return { students: 0, teachers: 0, schedules: 0, recordings: 0 };
      }

      const [studentsRes, teachersRes, schedulesRes, recordingsRes] = await Promise.all([
        supabase
          .from('user_enrollments')
          .select('*', { count: 'exact', head: true })
          .in('batch_name', managerInfo.assigned_batches),
        supabase
          .from('teachers')
          .select('*', { count: 'exact', head: true })
          .overlaps('assigned_batches', managerInfo.assigned_batches),
        supabase
          .from('schedules')
          .select('*', { count: 'exact', head: true })
          .in('batch', managerInfo.assigned_batches),
        supabase
          .from('recordings')
          .select('*', { count: 'exact', head: true })
          .in('batch', managerInfo.assigned_batches)
      ]);

      return {
        students: studentsRes.count || 0,
        teachers: teachersRes.count || 0,
        schedules: schedulesRes.count || 0,
        recordings: recordingsRes.count || 0
      };
    },
    enabled: !!managerInfo
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Batch Overview</h2>
        <p className="text-muted-foreground">Summary of your assigned batches</p>
      </div>

      {managerInfo && (
        <div className="flex flex-wrap gap-2 mb-4">
          <span className="text-sm text-muted-foreground">Managing Batches:</span>
          {managerInfo.assigned_batches?.map((batch: string) => (
            <Badge key={batch} variant="secondary">{batch}</Badge>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Students</p>
                <p className="text-3xl font-bold">{stats?.students || 0}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Teachers</p>
                <p className="text-3xl font-bold">{stats?.teachers || 0}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <BookOpen className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Classes</p>
                <p className="text-3xl font-bold">{stats?.schedules || 0}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <Calendar className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Recordings</p>
                <p className="text-3xl font-bold">{stats?.recordings || 0}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-full">
                <Video className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
