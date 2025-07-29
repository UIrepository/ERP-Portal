import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Layers, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Combobox } from '@/components/ui/combobox'; // Assuming a combobox component exists for multi-select

export const AdminBatchAllocation = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

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

  const { data: options = [] } = useQuery({
    queryKey: ['available-options'],
    queryFn: async () => {
      const { data } = await supabase.from('available_options').select('type, name');
      return data || [];
    }
  });

  const { batchOptions, subjectOptions } = useMemo(() => {
    return {
      batchOptions: options.filter(o => o.type === 'batch').map(o => o.name),
      subjectOptions: options.filter(o => o.type === 'subject').map(o => o.name)
    };
  }, [options]);

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
      toast({ title: "Success", description: "Allocation updated successfully" });
      setSelectedUser(null);
    },
    onError: (error) => {
      toast({ title: "Error", description: `Failed to update allocation: ${error.message}`, variant: "destructive" });
    },
  });

  const addOptionMutation = useMutation({
    mutationFn: async ({ type, name }: { type: 'batch' | 'subject', name: string }) => {
      // Check if it already exists to prevent unique constraint errors
      const { data } = await supabase.from('available_options').select('id').eq('type', type).eq('name', name).single();
      if (data) return; // Already exists

      const { error } = await supabase.from('available_options').insert({ type, name });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['available-options'] });
      toast({ title: "Success", description: "New option added" });
    },
     onError: (error) => {
      toast({ title: "Error", description: `Failed to add option: ${error.message}`, variant: "destructive" });
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
  
  const handleCreateOption = (type: 'batch' | 'subject', value: string) => {
    if (value.trim()) {
      addOptionMutation.mutate({ type, name: value });
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold flex items-center"><Layers className="mr-2 h-6 w-6" />Batch & Subject Allocation</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Students & Teachers</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {/* User list remains the same */}
          </CardContent>
        </Card>

        {selectedUser && (
          <Card>
            <CardHeader>
              <CardTitle>Allocate to {selectedUser.name}</CardTitle>
            </CardHeader>
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
