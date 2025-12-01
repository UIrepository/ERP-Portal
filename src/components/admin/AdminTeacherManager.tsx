import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserCheck, Plus, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Combobox } from '@/components/ui/combobox';

export const AdminTeacherManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedBatches, setEditedBatches] = useState<string[]>([]);
  const [editedSubjects, setEditedSubjects] = useState<string[]>([]);
  
  const { data: teachers = [] } = useQuery({
    queryKey: ['admin-teachers'],
    queryFn: async () => {
      // Using type assertion since 'teacher' role might not be in generated types
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'teacher' as any)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: options = [] } = useQuery({
    queryKey: ['available-options-teacher-manager'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_all_options');
      return data || [];
    }
  });

  const { batchOptions, subjectOptions } = useMemo(() => ({
    batchOptions: options.filter((o: any) => o.type === 'batch').map((o: any) => o.name),
    subjectOptions: options.filter((o: any) => o.type === 'subject').map((o: any) => o.name)
  }), [options]);

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
      queryClient.invalidateQueries({ queryKey: ['available-options-teacher-manager'] });
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
      batch: editedBatches,
      subjects: editedSubjects,
      is_active: selectedTeacher.is_active,
    });
  };

  const handleEditClick = (teacher: any) => {
    setSelectedTeacher(teacher);
    setEditedBatches(Array.isArray(teacher.batch) ? teacher.batch : (teacher.batch ? [teacher.batch] : []));
    setEditedSubjects(teacher.subjects || []);
    setIsEditing(true);
  };
  
  const handleCreateOption = (type: 'batch' | 'subject', value: string) => {
    const trimmedValue = value.trim();
    if (trimmedValue) {
      if (type === 'batch') {
          if (!editedBatches.includes(trimmedValue)) setEditedBatches([...editedBatches, trimmedValue]);
      } else {
          if (!editedSubjects.includes(trimmedValue)) setEditedSubjects([...editedSubjects, trimmedValue]);
      }
    }
  };

  const getUserBatches = (user: any) => {
      return Array.isArray(user.batch) ? user.batch : (user.batch ? [user.batch] : []);
  }

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
              {teachers.map((teacher) => (
                <div
                  key={teacher.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => {
                      setSelectedTeacher(teacher);
                      setIsEditing(false);
                  }}
                >
                  <div>
                    <h4 className="font-medium">{teacher.name}</h4>
                    <p className="text-sm text-muted-foreground">{teacher.email}</p>
                    <div className="flex gap-2 mt-2">
                      {getUserBatches(teacher).map((b: string) => <Badge key={b} variant="outline">{b}</Badge>)}
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
                        handleEditClick(teacher);
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
                {isEditing ? `Edit ${selectedTeacher.name}` : 'Teacher Details'}
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
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Batches</label>
                     <Combobox
                        options={batchOptions}
                        selected={editedBatches}
                        onChange={setEditedBatches}
                        onCreate={value => handleCreateOption('batch', value)}
                        placeholder="Select or create batches..."
                    />
                  </div>
                   <div>
                    <label className="block text-sm font-medium mb-1">Subjects</label>
                    <Combobox
                        options={subjectOptions}
                        selected={editedSubjects}
                        onChange={setEditedSubjects}
                        onCreate={value => handleCreateOption('subject', value)}
                        placeholder="Select or create subjects..."
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
                    <label className="block text-sm font-medium text-muted-foreground">Batches</label>
                     <div className="flex flex-wrap gap-1 mt-1">
                      {getUserBatches(selectedTeacher).map((batch: string) => (
                        <Badge key={batch} variant="outline">{batch}</Badge>
                      )) || <span className="text-sm text-muted-foreground">No batches assigned</span>}
                    </div>
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
                  <Button onClick={() => handleEditClick(selectedTeacher)}>Edit Teacher</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
