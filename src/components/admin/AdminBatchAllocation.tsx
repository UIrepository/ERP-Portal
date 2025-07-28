
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Layers, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const AdminBatchAllocation = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [newBatch, setNewBatch] = useState('');
  const [newSubjects, setNewSubjects] = useState<string[]>([]);
  const [subjectInput, setSubjectInput] = useState('');
  
  const { data: users } = useQuery({
    queryKey: ['admin-users-allocation'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['student', 'teacher'])
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const updateAllocationMutation = useMutation({
    mutationFn: async (allocationData: any) => {
      const { error } = await supabase
        .from('profiles')
        .update(allocationData)
        .eq('id', selectedUser.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-allocation'] });
      toast({ title: "Success", description: "Batch and subjects updated successfully" });
      setSelectedUser(null);
      setNewBatch('');
      setNewSubjects([]);
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to update allocation", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!selectedUser || !newBatch) return;
    
    updateAllocationMutation.mutate({
      batch: newBatch,
      subjects: newSubjects,
    });
  };

  const addSubject = () => {
    if (subjectInput.trim() && !newSubjects.includes(subjectInput.trim())) {
      setNewSubjects([...newSubjects, subjectInput.trim()]);
      setSubjectInput('');
    }
  };

  const removeSubject = (subject: string) => {
    setNewSubjects(newSubjects.filter(s => s !== subject));
  };

  const handleUserSelect = (user: any) => {
    setSelectedUser(user);
    setNewBatch(user.batch || '');
    setNewSubjects(user.subjects || []);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center">
          <Layers className="mr-2 h-6 w-6" />
          Batch & Subject Allocation
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle>Students & Teachers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {users?.map((user) => (
                <div
                  key={user.id}
                  className={`flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer ${
                    selectedUser?.id === user.id ? 'bg-muted border-primary' : ''
                  }`}
                  onClick={() => handleUserSelect(user)}
                >
                  <div>
                    <h4 className="font-medium">{user.name}</h4>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">{user.role}</Badge>
                      {user.batch && <Badge variant="secondary">{user.batch}</Badge>}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {user.subjects?.length || 0} subjects
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Allocation Form */}
        {selectedUser && (
          <Card>
            <CardHeader>
              <CardTitle>Allocate Batch & Subjects</CardTitle>
              <p className="text-sm text-muted-foreground">
                Editing: {selectedUser.name} ({selectedUser.role})
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Batch</label>
                <Input
                  value={newBatch}
                  onChange={(e) => setNewBatch(e.target.value)}
                  placeholder="e.g., 2024-A, 2024-B"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Subjects</label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={subjectInput}
                    onChange={(e) => setSubjectInput(e.target.value)}
                    placeholder="Enter subject name"
                    onKeyPress={(e) => e.key === 'Enter' && addSubject()}
                  />
                  <Button onClick={addSubject} variant="outline">Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {newSubjects.map((subject) => (
                    <Badge
                      key={subject}
                      variant="secondary"
                      className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => removeSubject(subject)}
                    >
                      {subject} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <Button onClick={handleSave} className="w-full">
                  <Save className="mr-2 h-4 w-4" />
                  Save Allocation
                </Button>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Current Allocation</h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium">Batch: </span>
                    <span className="text-sm">{selectedUser.batch || 'Not assigned'}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Subjects: </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedUser.subjects?.map((subject: string) => (
                        <Badge key={subject} variant="outline" className="text-xs">{subject}</Badge>
                      )) || <span className="text-sm text-muted-foreground">No subjects assigned</span>}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
