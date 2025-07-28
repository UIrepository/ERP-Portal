
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Plus, Upload, FileText, Video, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export const ContentManagement = () => {
  const [activeTab, setActiveTab] = useState('notes');
  const [isAddContentOpen, setIsAddContentOpen] = useState(false);
  const [newContent, setNewContent] = useState({
    title: '',
    subject: '',
    batch: '',
    file_url: '',
    filename: '',
    tags: [] as string[],
    embed_link: '',
    topic: '',
    date: ''
  });

  const queryClient = useQueryClient();

  // Notes queries
  const { data: notes = [] } = useQuery({
    queryKey: ['admin-notes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Recordings queries
  const { data: recordings = [] } = useQuery({
    queryKey: ['admin-recordings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recordings')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async (noteData: any) => {
      const { error } = await supabase
        .from('notes')
        .insert([noteData]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notes'] });
      setIsAddContentOpen(false);
      resetForm();
      toast({
        title: 'Success',
        description: 'Note added successfully',
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

  const addRecordingMutation = useMutation({
    mutationFn: async (recordingData: any) => {
      const { error } = await supabase
        .from('recordings')
        .insert([recordingData]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-recordings'] });
      setIsAddContentOpen(false);
      resetForm();
      toast({
        title: 'Success',
        description: 'Recording added successfully',
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

  const resetForm = () => {
    setNewContent({
      title: '',
      subject: '',
      batch: '',
      file_url: '',
      filename: '',
      tags: [],
      embed_link: '',
      topic: '',
      date: ''
    });
  };

  const handleAddNote = () => {
    addNoteMutation.mutate({
      title: newContent.title,
      subject: newContent.subject,
      batch: newContent.batch,
      file_url: newContent.file_url,
      filename: newContent.filename,
      tags: newContent.tags
    });
  };

  const handleAddRecording = () => {
    addRecordingMutation.mutate({
      subject: newContent.subject,
      batch: newContent.batch,
      topic: newContent.topic,
      embed_link: newContent.embed_link,
      date: newContent.date
    });
  };

  const subjectOptions = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Computer Science'];
  const batchOptions = ['2024-A', '2024-B', '2025-A', '2025-B'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Content Management</h2>
        <Dialog open={isAddContentOpen} onOpenChange={setIsAddContentOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Content
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Content</DialogTitle>
            </DialogHeader>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="recordings">Recordings</TabsTrigger>
              </TabsList>
              
              <TabsContent value="notes" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={newContent.title}
                      onChange={(e) => setNewContent({ ...newContent, title: e.target.value })}
                      placeholder="Enter note title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="filename">Filename</Label>
                    <Input
                      id="filename"
                      value={newContent.filename}
                      onChange={(e) => setNewContent({ ...newContent, filename: e.target.value })}
                      placeholder="Enter filename"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Select value={newContent.subject} onValueChange={(value) => setNewContent({ ...newContent, subject: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjectOptions.map((subject) => (
                          <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="batch">Batch</Label>
                    <Select value={newContent.batch} onValueChange={(value) => setNewContent({ ...newContent, batch: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select batch" />
                      </SelectTrigger>
                      <SelectContent>
                        {batchOptions.map((batch) => (
                          <SelectItem key={batch} value={batch}>{batch}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="file_url">File URL</Label>
                  <Input
                    id="file_url"
                    value={newContent.file_url}
                    onChange={(e) => setNewContent({ ...newContent, file_url: e.target.value })}
                    placeholder="Enter file URL"
                  />
                </div>
                <div>
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    value={newContent.tags.join(', ')}
                    onChange={(e) => setNewContent({ ...newContent, tags: e.target.value.split(',').map(tag => tag.trim()) })}
                    placeholder="Enter tags"
                  />
                </div>
                <Button onClick={handleAddNote} className="w-full">
                  Add Note
                </Button>
              </TabsContent>
              
              <TabsContent value="recordings" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="topic">Topic</Label>
                    <Input
                      id="topic"
                      value={newContent.topic}
                      onChange={(e) => setNewContent({ ...newContent, topic: e.target.value })}
                      placeholder="Enter topic"
                    />
                  </div>
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newContent.date}
                      onChange={(e) => setNewContent({ ...newContent, date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Select value={newContent.subject} onValueChange={(value) => setNewContent({ ...newContent, subject: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjectOptions.map((subject) => (
                          <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="batch">Batch</Label>
                    <Select value={newContent.batch} onValueChange={(value) => setNewContent({ ...newContent, batch: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select batch" />
                      </SelectTrigger>
                      <SelectContent>
                        {batchOptions.map((batch) => (
                          <SelectItem key={batch} value={batch}>{batch}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="embed_link">Embed Link</Label>
                  <Input
                    id="embed_link"
                    value={newContent.embed_link}
                    onChange={(e) => setNewContent({ ...newContent, embed_link: e.target.value })}
                    placeholder="Enter embed link"
                  />
                </div>
                <Button onClick={handleAddRecording} className="w-full">
                  Add Recording
                </Button>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="recordings">Recordings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="notes" className="space-y-4">
          <div className="grid gap-4">
            {notes.map((note) => (
              <Card key={note.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{note.title}</h3>
                      <p className="text-sm text-muted-foreground">{note.filename}</p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs bg-primary/10 px-2 py-1 rounded">{note.subject}</span>
                        <span className="text-xs bg-secondary/10 px-2 py-1 rounded">{note.batch}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm">
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="recordings" className="space-y-4">
          <div className="grid gap-4">
            {recordings.map((recording) => (
              <Card key={recording.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{recording.topic}</h3>
                      <p className="text-sm text-muted-foreground">{recording.date}</p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs bg-primary/10 px-2 py-1 rounded">{recording.subject}</span>
                        <span className="text-xs bg-secondary/10 px-2 py-1 rounded">{recording.batch}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm">
                        <Video className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
