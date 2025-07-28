
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const AdminStudentManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const { data: students } = useQuery({
    queryKey: ['admin-students'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const updateStudentMutation = useMutation({
    mutationFn: async (studentData: any) => {
      const { error } = await supabase
        .from('profiles')
        .update(studentData)
        .eq('id', selectedStudent.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      toast({ title: "Success", description: "Student updated successfully" });
      setIsEditing(false);
      setSelectedStudent(null);
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to update student", variant: "destructive" });
    },
  });

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateStudentMutation.mutate({
      name: selectedStudent.name,
      email: selectedStudent.email,
      batch: selectedStudent.batch,
      subjects: selectedStudent.subjects,
      is_active: selectedStudent.is_active,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center">
          <Users className="mr-2 h-6 w-6" />
          Student Management
        </h2>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Student
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Students List */}
        <Card>
          <CardHeader>
            <CardTitle>All Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {students?.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => setSelectedStudent(student)}
                >
                  <div>
                    <h4 className="font-medium">{student.name}</h4>
                    <p className="text-sm text-muted-foreground">{student.email}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">{student.batch}</Badge>
                      <Badge variant={student.is_active ? "default" : "secondary"}>
                        {student.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStudent(student);
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

        {/* Student Details/Edit */}
        {selectedStudent && (
          <Card>
            <CardHeader>
              <CardTitle>
                {isEditing ? 'Edit Student' : 'Student Details'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <Input
                      value={selectedStudent.name}
                      onChange={(e) => setSelectedStudent({ ...selectedStudent, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <Input
                      type="email"
                      value={selectedStudent.email}
                      onChange={(e) => setSelectedStudent({ ...selectedStudent, email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Batch</label>
                    <Input
                      value={selectedStudent.batch || ''}
                      onChange={(e) => setSelectedStudent({ ...selectedStudent, batch: e.target.value })}
                      placeholder="e.g., 2024-A"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Status</label>
                    <Select
                      value={selectedStudent.is_active ? 'active' : 'inactive'}
                      onValueChange={(value) => setSelectedStudent({ ...selectedStudent, is_active: value === 'active' })}
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
                    <p className="text-sm">{selectedStudent.name}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Email</label>
                    <p className="text-sm">{selectedStudent.email}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Batch</label>
                    <p className="text-sm">{selectedStudent.batch || 'Not assigned'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Subjects</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedStudent.subjects?.map((subject: string) => (
                        <Badge key={subject} variant="outline">{subject}</Badge>
                      )) || <span className="text-sm text-muted-foreground">No subjects assigned</span>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground">Status</label>
                    <Badge variant={selectedStudent.is_active ? "default" : "secondary"}>
                      {selectedStudent.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <Button onClick={() => setIsEditing(true)}>Edit Student</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
