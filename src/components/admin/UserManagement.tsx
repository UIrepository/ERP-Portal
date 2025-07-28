
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export const UserManagement = () => {
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'student',
    batch: '',
    subjects: [] as string[],
    exams: [] as string[],
    is_active: true
  });

  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const addUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const { error } = await supabase
        .from('profiles')
        .insert([userData]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setIsAddUserOpen(false);
      setNewUser({
        name: '',
        email: '',
        role: 'student',
        batch: '',
        subjects: [],
        exams: [],
        is_active: true
      });
      toast({
        title: 'Success',
        description: 'User added successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, ...userData }: any) => {
      const { error } = await supabase
        .from('profiles')
        .update(userData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({
        title: 'Success',
        description: 'User updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const toggleUserStatus = (user: any) => {
    updateUserMutation.mutate({
      id: user.id,
      is_active: !user.is_active
    });
  };

  const handleAddUser = () => {
    addUserMutation.mutate(newUser);
  };

  const subjectOptions = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Computer Science'];
  const examOptions = ['JEE Main', 'JEE Advanced', 'NEET', 'BITSAT', 'KVPY', 'NTSE'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">User Management</h2>
        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="Enter email"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="teacher">Teacher</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="batch">Batch</Label>
                  <Input
                    id="batch"
                    value={newUser.batch}
                    onChange={(e) => setNewUser({ ...newUser, batch: e.target.value })}
                    placeholder="Enter batch (e.g., 2024-A)"
                  />
                </div>
              </div>
              <div>
                <Label>Subjects</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {subjectOptions.map((subject) => (
                    <div key={subject} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={subject}
                        checked={newUser.subjects.includes(subject)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewUser({ ...newUser, subjects: [...newUser.subjects, subject] });
                          } else {
                            setNewUser({ ...newUser, subjects: newUser.subjects.filter(s => s !== subject) });
                          }
                        }}
                      />
                      <Label htmlFor={subject} className="text-sm">{subject}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label>Exams</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {examOptions.map((exam) => (
                    <div key={exam} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={exam}
                        checked={newUser.exams.includes(exam)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewUser({ ...newUser, exams: [...newUser.exams, exam] });
                          } else {
                            setNewUser({ ...newUser, exams: newUser.exams.filter(e => e !== exam) });
                          }
                        }}
                      />
                      <Label htmlFor={exam} className="text-sm">{exam}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={newUser.is_active}
                  onCheckedChange={(checked) => setNewUser({ ...newUser, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <Button onClick={handleAddUser} className="w-full">
                Add User
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {users.map((user) => (
          <Card key={user.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div>
                    <h3 className="font-semibold">{user.name}</h3>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <Badge variant={user.role === 'super_admin' ? 'default' : user.role === 'teacher' ? 'secondary' : 'outline'}>
                    {user.role}
                  </Badge>
                  <Badge variant="outline">{user.batch}</Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleUserStatus(user)}
                  >
                    {user.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <div>
                  <span className="text-sm font-medium">Subjects: </span>
                  <span className="text-sm">{user.subjects?.join(', ') || 'None'}</span>
                </div>
                <div>
                  <span className="text-sm font-medium">Exams: </span>
                  <span className="text-sm">{user.exams?.join(', ') || 'None'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
