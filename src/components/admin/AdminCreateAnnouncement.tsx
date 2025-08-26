import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Megaphone, Send } from 'lucide-react';
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
      target_batch: selectedBatches.length > 0 ? selectedBatches[0] : null, // Simplified for now
      target_subject: selectedSubjects.length > 0 ? selectedSubjects[0] : null, // Simplified for now
      created_by: profile?.user_id,
      is_active: true,
      target_role: 'student'
    });
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50/50 min-h-full">
        <div className="relative p-8 rounded-3xl overflow-hidden shadow-2xl bg-gradient-to-r from-primary to-indigo-600 text-white animate-fade-in-up">
            <div className="absolute -top-16 -left-16 w-48 h-48 bg-white/10 rounded-full animate-pulse-slow"></div>
            <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-white/10 rounded-full animate-pulse-slow animation-delay-500"></div>
            <div className="relative z-10 text-center">
                <div className="flex items-center justify-center mb-4">
                    <Megaphone className="h-16 w-16 text-white drop-shadow-md" />
                </div>
                <h1 className="text-4xl md:text-5xl font-bold mb-2 tracking-tight drop-shadow-lg">
                    Create Announcement
                </h1>
                <p className="text-xl md:text-2xl text-indigo-100 drop-shadow-sm font-semibold">
                    Broadcast important messages to students.
                </p>
            </div>
        </div>
      
      <Card className="shadow-lg rounded-2xl">
        <CardHeader>
          <CardTitle>Announcement Details</CardTitle>
          <CardDescription>Compose and target your announcement to specific student groups.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="font-medium">Title</label>
            <Input 
              placeholder="E.g., Extra Class for Physics" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="font-medium">Message</label>
            <Textarea 
              placeholder="Enter the full announcement details here..." 
              value={message} 
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <label className="font-medium">Target Batches (Optional)</label>
                <Combobox
                    options={batchOptions}
                    selected={selectedBatches}
                    onChange={setSelectedBatches}
                    placeholder="All Batches"
                />
            </div>
            <div className="space-y-2">
                <label className="font-medium">Target Subjects (Optional)</label>
                <Combobox
                    options={subjectOptions}
                    selected={selectedSubjects}
                    onChange={setSelectedSubjects}
                    placeholder="All Subjects"
                />
            </div>
          </div>
          <Button 
            onClick={handleSendAnnouncement} 
            disabled={createAnnouncementMutation.isPending}
            className="w-full"
            size="lg"
          >
            <Send className="mr-2 h-5 w-5" />
            {createAnnouncementMutation.isPending ? 'Sending...' : 'Send Announcement'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
