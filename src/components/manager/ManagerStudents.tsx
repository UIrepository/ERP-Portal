import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Mail, GraduationCap } from 'lucide-react';

export const ManagerStudents = () => {
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

  const { data: students, isLoading } = useQuery({
    queryKey: ['managerStudents', managerInfo?.assigned_batches],
    queryFn: async () => {
      if (!managerInfo?.assigned_batches?.length) return [];
      
      // Get enrollments for assigned batches
      const { data: enrollments, error: enrollError } = await supabase
        .from('user_enrollments')
        .select('user_id, batch_name, subject_name, email')
        .in('batch_name', managerInfo.assigned_batches);
      
      if (enrollError) throw enrollError;
      
      // Get unique user IDs
      const userIds = [...new Set(enrollments?.map(e => e.user_id) || [])];
      if (!userIds.length) return [];
      
      // Get profile info
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);
      
      if (profileError) throw profileError;
      
      // Combine data
      return profiles?.map(profile => {
        const userEnrollments = enrollments?.filter(e => e.user_id === profile.user_id) || [];
        return {
          ...profile,
          batches: [...new Set(userEnrollments.map(e => e.batch_name))],
          subjects: [...new Set(userEnrollments.map(e => e.subject_name))]
        };
      }) || [];
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
        <h2 className="text-xl font-semibold">Students</h2>
        <p className="text-muted-foreground">Students enrolled in your batches</p>
      </div>

      {!students?.length ? (
        <Card>
          <CardContent className="p-8 text-center">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No students enrolled in your batches yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {students.map((student) => (
            <Card key={student.user_id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-full">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{student.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <Mail className="h-3 w-3" />
                      {student.email}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {student.batches?.map((batch: string) => (
                        <Badge key={batch} variant="outline" className="text-xs">{batch}</Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {student.subjects?.map((subject: string) => (
                        <Badge key={subject} variant="secondary" className="text-xs">{subject}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
