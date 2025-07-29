import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Layers, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Combobox } from '@/components/ui/combobox'; // This is a custom component for multi-select with creation

export const AdminBatchAllocation = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  const { data: users } = useQuery({ /* ...fetches users... */ });

  // This query now scans ALL profiles to get every unique batch and subject name
  const { data: options = [] } = useQuery({
    queryKey: ['available-options'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('batch, subjects');
      const batchSet = new Set<string>();
      const subjectSet = new Set<string>();
      data?.forEach(profile => {
        const batches = Array.isArray(profile.batch) ? profile.batch : [profile.batch];
        batches.forEach(b => { if(b) batchSet.add(b) });
        profile.subjects?.forEach(s => subjectSet.add(s));
      });
      return {
          batches: Array.from(batchSet).sort(),
          subjects: Array.from(subjectSet).sort()
      };
    }
  });

  const updateAllocationMutation = useMutation({ /* ...updates user profiles... */ });

  const handleSave = () => { /* ...saves allocation... */ };
  const handleUserSelect = (user: any) => { /* ...handles user selection... */ };
  
  // This function is for creating a new batch/subject name if it doesn't exist
  // It's a placeholder as we're now dynamically getting options from existing profiles
  const handleCreateOption = (type: 'batch' | 'subject', value: string) => {
    // In this new model, you create a new batch/subject simply by assigning it to a user.
    // The next time the page loads, it will appear in the options automatically.
    toast({ title: "Info", description: `To create a new ${type}, just type it and assign it to a user.` });
    if (type === 'batch') {
        if (!selectedBatches.includes(value)) setSelectedBatches([...selectedBatches, value]);
    } else {
        if (!selectedSubjects.includes(value)) setSelectedSubjects([...selectedSubjects, value]);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold flex items-center"><Layers className="mr-2 h-6 w-6" />Batch & Subject Allocation</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
            {/* User list remains the same */}
        </Card>

        {selectedUser && (
          <Card>
            <CardHeader><CardTitle>Allocate to {selectedUser.name}</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Batches</label>
                <Combobox
                    options={options.batches}
                    selected={selectedBatches}
                    onChange={setSelectedBatches}
                    onCreate={value => handleCreateOption('batch', value)}
                    placeholder="Select or create batches..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Subjects</label>
                <Combobox
                    options={options.subjects}
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
