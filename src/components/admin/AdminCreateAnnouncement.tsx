import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Megaphone, Send, Users, Book, Loader2, Plus, X } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

// New interface for defining a target combination of batch and subject
interface TargetCombination {
  batch: string | null;
  subject: string | null;
}

export const AdminCreateAnnouncement = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  // State to hold multiple target combinations
  const [targets, setTargets] = useState<TargetCombination[]>([]);
  // State for the current selection in the dropdowns
  const [currentBatch, setCurrentBatch] = useState<string | null>(null);
  const [currentSubject, setCurrentSubject] = useState<string | null>(null);

  // Fetch all enrollments to understand batch-subject relationships
  const { data: enrollments = [] } = useQuery({
    queryKey: ['all-enrollments-for-announcements'],
    queryFn: async () => {
      const { data } = await supabase.from('user_enrollments').select('batch_name, subject_name');
      return data || [];
    }
  });

  // Memoized derivation of unique batches and subjects based on enrollments
  const { allBatches, subjectsForSelectedBatch } = useMemo(() => {
    const uniqueBatches = Array.from(new Set(enrollments.map(e => e.batch_name))).sort();
    let subjectsForBatch: string[] = [];
    if (currentBatch) {
      subjectsForBatch = Array.from(
        new Set(enrollments.filter(e => e.batch_name === currentBatch).map(e => e.subject_name))
      ).sort();
    } else {
        // If no batch is selected, show all unique subjects across all batches.
        subjectsForBatch = Array.from(new Set(enrollments.map(e => e.subject_name))).sort()
    }
    return { allBatches: uniqueBatches, subjectsForSelectedBatch: subjectsForBatch };
  }, [enrollments, currentBatch]);


  const createAnnouncementMutation = useMutation({
    mutationFn: async (announcementData: any) => {
        // The announcements are now inserted as an array
      const { error } = await supabase.from('notifications').insert(announcementData);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Announcement has been sent." });
      setTitle('');
      setMessage('');
      setTargets([]);
      setCurrentBatch(null);
      setCurrentSubject(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: `Failed to send announcement: ${error.message}`, variant: "destructive" });
    },
  });

  // Adds the currently selected combination to the list of targets
  const handleAddTarget = () => {
    if (!currentBatch && !currentSubject) {
      toast({ title: "Info", description: "Select a batch and/or a subject to add a target.", variant: "default" });
      return;
    }
    const newTarget = { batch: currentBatch, subject: currentSubject };
    // Avoid adding duplicate targets
    if (!targets.some(t => t.batch === newTarget.batch && t.subject === newTarget.subject)) {
      setTargets([...targets, newTarget]);
      setCurrentBatch(null)
      setCurrentSubject(null)
    } else {
        toast({title: "Duplicate Target", description: "This batch/subject combination has already been added.", variant: "default"})
    }
  };

    // Removes a target from the list
  const handleRemoveTarget = (index: number) => {
    setTargets(targets.filter((_, i) => i !== index));
  };


  const handleSendAnnouncement = () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Error", description: "Title and message are required.", variant: "destructive" });
      return;
    }

    let announcementsToSend = [];
    // If no specific targets, send a single global announcement.
    if (targets.length === 0) {
        announcementsToSend.push({
            title,
            message,
            target_batch: null,
            target_subject: null,
            created_by: profile?.user_id,
            is_active: true,
            target_role: 'student'
        })
    } else {
        // Otherwise, create an announcement for each target combination
        announcementsToSend = targets.map(target => ({
             title,
            message,
            target_batch: target.batch,
            target_subject: target.subject,
            created_by: profile?.user_id,
            is_active: true,
            target_role: 'student'
        }))
    }

    createAnnouncementMutation.mutate(announcementsToSend);
  };

  return (
    <div className="p-4 md:p-6 space-y-8 bg-slate-50 min-h-full animate-fade-in-up">
        <div className="flex flex-col space-y-1">
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Broadcast Center</h1>
            <p className="text-slate-500">Compose and dispatch announcements to your students.</p>
        </div>
      
      <div className="space-y-8">
        {/* Step 1: Compose Message */}
        <Card className="shadow-lg rounded-2xl border-slate-200">
            <CardHeader>
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Megaphone className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <CardTitle>Compose Message</CardTitle>
                        <CardDescription>Craft the title and content of your announcement.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-2">
                <div className="space-y-2">
                    <label className="font-medium text-slate-700">Title</label>
                    <Input 
                    placeholder="E.g., Important Update: Physics Extra Class" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-base"
                    />
                </div>
                <div className="space-y-2">
                    <label className="font-medium text-slate-700">Message</label>
                    <Textarea 
                    placeholder="Enter the full announcement details here. You can use markdown for formatting." 
                    value={message} 
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    className="text-base"
                    />
                </div>
            </CardContent>
        </Card>

        {/* Step 2: Targeting */}
        <Card className="shadow-lg rounded-2xl border-slate-200">
            <CardHeader>
                <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <CardTitle>Target Audience</CardTitle>
                        <CardDescription>Select batches and subjects to target. Leave blank to send to all.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="font-medium text-slate-700 flex items-center gap-2"><Users className="h-4 w-4"/> Batches</label>
                        <Combobox
                            options={allBatches}
                            selected={currentBatch ? [currentBatch] : []}
                            onChange={(batches) => setCurrentBatch(batches[0] || null)}
                            placeholder="All Batches"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="font-medium text-slate-700 flex items-center gap-2"><Book className="h-4 w-4"/> Subjects</label>
                        <Combobox
                            options={subjectsForSelectedBatch}
                            selected={currentSubject ? [currentSubject] : []}
                            onChange={(subjects) => setCurrentSubject(subjects[0] || null)}
                            placeholder="All Subjects"
                        />
                    </div>
                </div>
                <div className="flex justify-end mt-4">
                    <Button onClick={handleAddTarget} size="sm">
                        <Plus className="h-4 w-4 mr-2"/>
                        Add Target Combination
                    </Button>
                </div>
                <Separator className="my-6"/>
                 <div>
                    <h4 className="font-medium text-slate-700 mb-3">Selected Targets:</h4>
                    <div className="flex flex-wrap gap-2">
                    {targets.length === 0 && <p className="text-sm text-slate-500">No specific targets added. Announcement will be sent to all students.</p>}
                    {targets.map((target, index) => (
                        <Badge key={index} variant="outline" className="text-base py-1 px-3">
                        {target.batch || 'All Batches'} / {target.subject || 'All Subjects'}
                        <button onClick={() => handleRemoveTarget(index)} className="ml-2 hover:text-red-500">
                            <X className="h-4 w-4"/>
                        </button>
                        </Badge>
                    ))}
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* Step 3: Send */}
        <div className="flex justify-end">
          <Button 
            onClick={handleSendAnnouncement} 
            disabled={createAnnouncementMutation.isPending}
            className="w-full md:w-auto bg-primary hover:bg-primary/90 text-white font-semibold transition-all transform hover:scale-105 active:scale-95"
            size="lg"
          >
            {createAnnouncementMutation.isPending ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
                <Send className="mr-2 h-5 w-5" />
            )}
            {createAnnouncementMutation.isPending ? 'Sending...' : 'Send Announcement'}
          </Button>
        </div>
      </div>
    </div>
  );
};
