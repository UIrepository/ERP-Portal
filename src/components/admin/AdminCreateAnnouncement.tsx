import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Megaphone, Send, Users, Book, Loader2 } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';

export const AdminCreateAnnouncement = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  const { data: options = [] } = useQuery({
    queryKey: ['available-options-announcements'],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_all_options');
      return data || [];
    }
  });

  const { batchOptions, subjectOptions } = useMemo(() => ({
    batchOptions: options.filter((o: any) => o.type === 'batch').map((o: any) => o.name),
    subjectOptions: options.filter((o: any) => o.type === 'subject').map((o: any) => o.name)
  }), [options]);

  const createAnnouncementMutation = useMutation({
    mutationFn: async (announcementData: any) => {
      const { error } = await supabase.from('notifications').insert([announcementData]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Announcement has been sent." });
      setTitle('');
      setMessage('');
      setSelectedBatches([]);
      setSelectedSubjects([]);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: `Failed to send announcement: ${error.message}`, variant: "destructive" });
    },
  });

  const handleSendAnnouncement = () => {
    if (!title.trim() || !message.trim()) {
      toast({ title: "Error", description: "Title and message are required.", variant: "destructive" });
      return;
    }

    createAnnouncementMutation.mutate({
      title,
      message,
      target_batch: selectedBatches.length > 0 ? selectedBatches[0] : null,
      target_subject: selectedSubjects.length > 0 ? selectedSubjects[0] : null,
      created_by: profile?.user_id,
      is_active: true,
      target_role: 'student'
    });
  };

  return (
    <div className="p-4 md:p-6 space-y-8 bg-slate-50 min-h-full animate-fade-in-up">
        <div className="flex flex-col space-y-1">
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Broadcast Center</h1>
            <p className="text-slate-500">Compose and dispatch announcements to your students.</p>
        </div>
      
      <div className="space-y-8">
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
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                    <label className="font-medium text-slate-700 flex items-center gap-2"><Users className="h-4 w-4"/> Batches</label>
                    <Combobox
                        options={batchOptions}
                        selected={selectedBatches}
                        onChange={setSelectedBatches}
                        placeholder="All Batches"
                    />
                </div>
                <div className="space-y-2">
                    <label className="font-medium text-slate-700 flex items-center gap-2"><Book className="h-4 w-4"/> Subjects</label>
                    <Combobox
                        options={subjectOptions}
                        selected={selectedSubjects}
                        onChange={setSelectedSubjects}
                        placeholder="All Subjects"
                    />
                </div>
            </CardContent>
        </Card>

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
