import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Layers, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Combobox } from '@/components/ui/combobox';

export const AdminBatchAllocation = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users-allocation'],
    queryFn: async () => {
        const { data } = await supabase.from('profiles').select('*');
        return data || [];
    }
  });

  // This query now just reads the master list, which is auto-populated by the trigger
  const { data: options = [] } = useQuery({
    queryKey: ['available-options'],
    queryFn: async () => {
      const { data } = await supabase.from('available_options').select('type, name');
      return data || [];
    }
  });

  const { batchOptions, subjectOptions } = useMemo(() => ({
    batchOptions: options.filter(o => o.type === 'batch').map(o => o.name),
    subjectOptions: options.filter(o => o.type === 'subject').map(o => o.name)
  }), [options]);

  const updateAllocationMutation = useMutation({
    mutationFn: async (allocationData: { batch: string[], subjects: string[] }) => {
      const { error } = await supabase
        .from('profiles')
        .update(allocationData)
        .eq('id', selectedUser.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-allocation'] });
      // The trigger will have updated the options, so we refetch them
      queryClient.invalidateQueries({ queryKey: ['available-options'] });
      toast({ title: "Success", description: "Allocation updated successfully. Any new options are now synced." });
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: `Failed to update allocation: ${error.message}`, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!selectedUser) return;
    updateAllocationMutation.mutate({
      batch: selectedBatches,
      subjects: selectedSubjects,
    });
  };

  const handleUserSelect = (user: any) => {
    setSelectedUser(user);
    setSelectedBatches(Array.isArray(user.batch) ? user.batch : (user.batch ? [user.batch] : []));
    setSelectedSubjects(user.subjects || []);
  };
  
  // This function now just adds the new temporary value to the state
  const handleCreateOption = (type: 'batch' | 'subject', value: string) => {
    const trimmedValue = value.trim();
    if (trimmedValue) {
      if (type === 'batch') {
          if (!selectedBatches.includes(trimmedValue)) setSelectedBatches([...selectedBatches, trimmedValue]);
      } else {
          if (!selectedSubjects.includes(trimmedValue)) setSelectedSubjects([...selectedSubjects, trimmedValue]);
      }
    }
  };

  const getUserBatches = (user: any) => {
      return Array.isArray(user.batch) ? user.batch : (user.batch ? [user.batch] : []);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold flex items-center"><Layers className="mr-2 h-6 w-6" />Batch & Subject Allocation</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
            <CardHeader>
                <CardTitle>Users</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3 h-96 overflow-y-auto">
                    {users.map(user => (
                        <div key={user.id} onClick={() => handleUserSelect(user)} className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                            <h4 className="font-medium">{user.name} ({user.role})</h4>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                                {getUserBatches(user).map((b: string) => <Badge key={b} variant="secondary">{b}</Badge>)}
                                {user.subjects?.map((s: string) => <Badge key={s} variant="outline">{s}</Badge>)}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>

        {selectedUser && (
          <Card>
            <CardHeader><CardTitle>Allocate to {selectedUser.name}</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Batches</label>
                <Combobox
                    options={batchOptions}
                    selected={selectedBatches}
                    onChange={setSelectedBatches}
                    onCreate={value => handleCreateOption('batch', value)}
                    placeholder="Select or create batches..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Subjects</label>
                <Combobox
                    options={subjectOptions}
                    selected={selectedSubjects}
                    onChange={setSelectedSubjects}
                    onCreate={value => handleCreateOption('subject', value)}
                    placeholder="Select or create subjects..."
                />
              </div>
              <Button onClick={handleSave} className="w-full"><Save className="mr-2 h-4 w-4" />Save Allocation</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
