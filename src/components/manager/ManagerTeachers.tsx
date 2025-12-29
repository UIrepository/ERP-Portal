import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Mail } from 'lucide-react';

export const ManagerTeachers = () => {
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

  const { data: teachers, isLoading } = useQuery({
    queryKey: ['managerTeachers', managerInfo?.assigned_batches],
    queryFn: async () => {
      if (!managerInfo?.assigned_batches?.length) return [];
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .overlaps('assigned_batches', managerInfo.assigned_batches);
      if (error) throw error;
      return data || [];
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
        <h2 className="text-xl font-semibold">Teachers</h2>
        <p className="text-muted-foreground">Teachers assigned to your batches</p>
      </div>

      {!teachers?.length ? (
        <Card>
          <CardContent className="p-8 text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No teachers assigned to your batches yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teachers.map((teacher) => (
            <Card key={teacher.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-full">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{teacher.name}</h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <Mail className="h-3 w-3" />
                      {teacher.email}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {teacher.assigned_subjects?.map((subject: string) => (
                        <Badge key={subject} variant="secondary" className="text-xs">{subject}</Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {teacher.assigned_batches?.map((batch: string) => (
                        <Badge key={batch} variant="outline" className="text-xs">{batch}</Badge>
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
