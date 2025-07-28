
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCheck, Plus, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const AdminTeacherManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const { data: teachers } = useQuery({
    queryKey: ['admin-teachers'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'teacher')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const updateTeacherMutation = useMutation({
    mutationFn: async (teacherData: any) => {
      const { error } = await supabase
        .from('profiles')
        .update(teacherData)
        .eq('id', selectedTeacher.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-teachers'] });
      toast({ title: "Success", description: "Teacher updated successfully" });
      setIsEditing(false);
      setSelectedTeacher(null);
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to update teacher", variant: "destructive" });
    },
  });

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateTeacherMutation.mutate({
      name: selectedTeacher.name,
      email: selectedTeacher.email,
      batch: selectedTeacher.batch,
      subjects: selectedTeacher.subjects,
      is_active: selectedTeacher.is_active,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center">
          <UserCheck className="mr-2 h-6 w-6" />
          Teacher Management
        </h2>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Teacher
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Teachers List */}
        <Card>
          <CardHeader>
            <CardTitle>All Teachers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {teachers?.map((teacher) => (
                <div
                  key={teacher.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => setSelectedTeacher(teacher)}
                >
                  <div>
                    <h4 className="font-medium">{teacher.name}</h4>
                    <p className="text-sm text-muted-foreground">{teacher.email}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">{teacher.batch}</Badge>
                      <Badge variant={teacher.is_active ? "default" : "secondary"}>
                        {teacher.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTeacher(teacher);
                        setIsEditing(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Teacher Details/Edit */}
        {selectedTeacher && (
          <Card>
            <CardHeader>
              <CardTitle>
                {isEditing ? 'Edit Teacher' : 'Teacher Details'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <Input
                      value={selectedTeacher.name}
                      onChange={(e) => setSelectedTeacher({ ...selectedTeacher, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <Input
                      type="email"
                      value={selectedTeacher.email}
                      onChange={(e) => setSelectedTeacher({ ...selectedTeacher, email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Batch</label>
                    <Input
                      value={selectedTeacher.batch || ''}
                      onChange={(e) => setSelectedTeacher({ ...selectedTeacher, batch: e.target.value })}
                      placeholder="e.g., 2024-A"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Status</label>
                    <Select
                      value={selectedTeacher.is_active ? 'active' : 'inactive'}
                      onValueChange={(value) => setSelectedTeacher({ ...selectedTeacher, is_active: value === 'active' })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit">Save Changes</Button>
                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Name</label>
                    <p className="text-sm">{selectedTeacher.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Email</label>
                    <p className="text-sm">{selectedTeacher.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Batch</label>
                    <p className="text-sm">{selectedTeacher.batch || 'Not assigned'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Subjects</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedTeacher.subjects?.map((subject: string) => (
                        <Badge key={subject} variant="outline">{subject}</Badge>
                      )) || <span className="text-sm text-muted-foreground">No subjects assigned</span>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Status</label>
                    <Badge variant={selectedTeacher.is_active ? "default" : "secondary"}>
                      {selectedTeacher.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <Button onClick={() => setIsEditing(true)}>Edit Teacher</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
