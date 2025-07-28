
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Video, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const AdminContentUpload = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [contentType, setContentType] = useState<'recording' | 'note'>('recording');
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    batch: '',
    date: '',
    topic: '',
    embed_link: '',
    file_url: '',
    filename: '',
    tags: '',
  });

  const uploadRecordingMutation = useMutation({
    mutationFn: async (recordingData: any) => {
      const { error } = await supabase
        .from('recordings')
        .insert([recordingData]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recordings'] });
      toast({ title: "Success", description: "Recording uploaded successfully" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to upload recording", variant: "destructive" });
    },
  });

  const uploadNoteMutation = useMutation({
    mutationFn: async (noteData: any) => {
      const { error } = await supabase
        .from('notes')
        .insert([noteData]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast({ title: "Success", description: "Note uploaded successfully" });
      resetForm();
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to upload note", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      title: '',
      subject: '',
      batch: '',
      date: '',
      topic: '',
      embed_link: '',
      file_url: '',
      filename: '',
      tags: '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (contentType === 'recording') {
      uploadRecordingMutation.mutate({
        topic: formData.topic,
        subject: formData.subject,
        batch: formData.batch,
        date: formData.date,
        embed_link: formData.embed_link,
      });
    } else {
      uploadNoteMutation.mutate({
        title: formData.title,
        subject: formData.subject,
        batch: formData.batch,
        filename: formData.filename,
        file_url: formData.file_url,
        tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : [],
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center">
          <Upload className="mr-2 h-6 w-6" />
          Content Upload
        </h2>
        <p className="text-sm text-muted-foreground">
          Upload embed links for recordings and notes
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Content</CardTitle>
          <div className="flex gap-2">
            <Button
              variant={contentType === 'recording' ? 'default' : 'outline'}
              onClick={() => setContentType('recording')}
            >
              <Video className="mr-2 h-4 w-4" />
              Recording
            </Button>
            <Button
              variant={contentType === 'note' ? 'default' : 'outline'}
              onClick={() => setContentType('note')}
            >
              <FileText className="mr-2 h-4 w-4" />
              Note
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {contentType === 'recording' ? 'Topic' : 'Title'}
                </label>
                <Input
                  value={contentType === 'recording' ? formData.topic : formData.title}
                  onChange={(e) => setFormData({
                    ...formData,
                    [contentType === 'recording' ? 'topic' : 'title']: e.target.value
                  })}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Batch</label>
                <Input
                  value={formData.batch}
                  onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                  required
                />
              </div>
              
              {contentType === 'recording' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Date</label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
              )}
              
              {contentType === 'note' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Filename</label>
                  <Input
                    value={formData.filename}
                    onChange={(e) => setFormData({ ...formData, filename: e.target.value })}
                    placeholder="e.g., Chapter_1_Notes.pdf"
                    required
                  />
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                {contentType === 'recording' ? 'Embed Link' : 'File URL'}
              </label>
              <Input
                value={contentType === 'recording' ? formData.embed_link : formData.file_url}
                onChange={(e) => setFormData({
                  ...formData,
                  [contentType === 'recording' ? 'embed_link' : 'file_url']: e.target.value
                })}
                placeholder={contentType === 'recording' ? 'https://youtube.com/embed/...' : 'https://drive.google.com/file/...'}
                required
              />
            </div>
            
            {contentType === 'note' && (
              <div>
                <label className="block text-sm font-medium mb-1">Tags (comma-separated)</label>
                <Input
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="e.g., important, exam, theory"
                />
              </div>
            )}
            
            <Button type="submit" className="w-full">
              <Upload className="mr-2 h-4 w-4" />
              Upload {contentType === 'recording' ? 'Recording' : 'Note'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload Guidelines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-green-700">✅ Allowed:</h4>
              <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                <li>• Embed links (YouTube, Vimeo, etc.)</li>
                <li>• Preview links (Google Drive, Dropbox, etc.)</li>
                <li>• Direct links to viewable content</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-red-700">❌ Not Allowed:</h4>
              <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                <li>• File uploads</li>
                <li>• Zip or CSV bulk uploads</li>
                <li>• Local file references</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-blue-700">📋 Notes:</h4>
              <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                <li>• Content shows as embedded players only</li>
                <li>• Download buttons available only for students</li>
                <li>• All content is batch and subject specific</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
