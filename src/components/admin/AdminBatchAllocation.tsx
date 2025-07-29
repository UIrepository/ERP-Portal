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

  // Fetches users to be allocated
  const { data: users } = useQuery({ /* ... */ });

  // Fetches the central list of options
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

  const updateAllocationMutation = useMutation({ /* ... */ });

  // Mutation to add a new option to the central list
  const addOptionMutation = useMutation({
    mutationFn: async ({ type, name }: { type: 'batch' | 'subject', name: string }) => {
      const { data } = await supabase.from('available_options').select('id').eq('type', type).eq('name', name).single();
      if (data) return; // Avoid duplicates

      const { error } = await supabase.from('available_options').insert({ type, name });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['available-options'] });
      toast({ title: "Success", description: "New option added to central list" });
    },
    onError: (error) => toast({ title: "Error", description: `Failed to add option: ${error.message}`, variant: "destructive" }),
  });

  const handleSave = () => { /* ... */ };
  const handleUserSelect = (user: any) => { /* ... */ };
  
  const handleCreateOption = (type: 'batch' | 'subject', value: string) => {
    if (value.trim()) {
      addOptionMutation.mutate({ type, name: value });
    }
  };

  return (
    // JSX now uses Combobox which allows creating new entries, triggering handleCreateOption
    <div className="space-y-6">
      {/* ... UI for allocation ... */}
    </div>
  );
};
