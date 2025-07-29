import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link as LinkIcon, Save, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

export const AdminMeetingManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newLinkData, setNewLinkData] = useState({ batch: '', subject: '', link: '' });

  const { data: profiles = [] } = useQuery({
    queryKey: ['all-profiles-for-filters'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('batch, subjects');
      if (error) throw error;
      return data || [];
    }
  });

  const { batchOptions, subjectOptions } = useMemo(() => {
    const batches = new Set<string>();
    const subjects = new Set<string>();
    profiles.forEach(p => {
      const userBatches = Array.isArray(p.batch) ? p.batch : [p.batch];
      userBatches.forEach(b => { if(b) batches.add(b); });
      p.subjects?.forEach(s => subjects.add(s));
    });
    return {
      batchOptions: Array.from(batches).sort(),
      subjectOptions: Array.from(subjects).sort(),
    };
  }, [profiles]);

  const updateLinksMutation = useMutation({
    mutationFn: async ({ batch, subject, link }: { batch: string; subject: string; link: string }) => {
      const { error } = await supabase
        .from('schedules')
        .update({ link: link || null })
        .match({ batch, subject });
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-meeting-schedules'] });
      toast({ title: "Success", description: `Meeting link for ${variables.subject} (${variables.batch}) has been updated.` });
      setIsDialogOpen(false);
      setNewLinkData({ batch: '', subject: '', link: '' });
    },
    onError: (error) => {
      toast({ title: "Error", description: `Failed to update meeting link: ${error.message}`, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!newLinkData.batch || !newLinkData.subject) {
        toast({ title: "Error", description: "Please select both a batch and a subject.", variant: "destructive" });
        return;
    }
    updateLinksMutation.mutate(newLinkData);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center">
          <LinkIcon className="mr-2 h-6 w-6" />
          Universal Meeting Link Manager
        </h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add / Update Link
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add or Update a Universal Meeting Link</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div>
                    <label className="text-sm font-medium">Batch</label>
                    <Select value={newLinkData.batch} onValueChange={(value) => setNewLinkData(prev => ({...prev, batch: value}))}>
                        <SelectTrigger><SelectValue placeholder="Select a batch..." /></SelectTrigger>
                        <SelectContent>
                            {batchOptions.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <label className="text-sm font-medium">Subject</label>
                    <Select value={newLinkData.subject} onValueChange={(value) => setNewLinkData(prev => ({...prev, subject: value}))}>
                        <SelectTrigger><SelectValue placeholder="Select a subject..." /></SelectTrigger>
                        <SelectContent>
                            {subjectOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <label className="text-sm font-medium">Meeting Link</label>
                    <Input 
                        value={newLinkData.link}
                        onChange={(e) => setNewLinkData(prev => ({...prev, link: e.target.value}))}
                        placeholder="https://meet.google.com/... (leave blank to remove)"
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave}><Save className="mr-2 h-4 w-4" />Save Link</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
            <CardTitle>Current Links</CardTitle>
            <p className="text-sm text-muted-foreground">
                This is a view of current schedules that have links. Use the button above to manage links for any combination.
            </p>
        </CardHeader>
        <CardContent>
            {/* The existing view of schedules can remain here as a reference if you wish */}
            <div className="text-center py-8 text-muted-foreground">
                <p>Use the "Add / Update Link" button to manage universal meeting links.</p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
};
