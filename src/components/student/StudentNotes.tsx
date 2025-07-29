
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Search } from 'lucide-react';

export const StudentNotes = () => {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | undefined>(undefined);

  const { data: notes } = useQuery({
    queryKey: ['student-notes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .eq('batch', profile?.batch)
        .in('subject', profile?.subjects || [])
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!profile?.batch && !!profile?.subjects
  });

  const filteredNotes = notes?.filter(note => {
    const matchesSearch = !searchTerm || 
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.filename.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSubject = !selectedSubject || note.subject === selectedSubject;
    
    return matchesSearch && matchesSubject;
  });

  const handleDownload = async (note: any) => {
    // Add watermark overlay with student name
    const watermarkText = `${profile?.name} - ${profile?.email}`;
    
    // Create a temporary link element for download
    const link = document.createElement('a');
    link.href = note.file_url;
    link.download = note.filename;
    link.style.display = 'none';
    
    // Add watermark overlay
    const watermarkDiv = document.createElement('div');
    watermarkDiv.style.position = 'fixed';
    watermarkDiv.style.top = '50%';
    watermarkDiv.style.left = '50%';
    watermarkDiv.style.transform = 'translate(-50%, -50%)';
    watermarkDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
    watermarkDiv.style.color = 'rgba(0, 0, 0, 0.3)';
    watermarkDiv.style.padding = '10px';
    watermarkDiv.style.borderRadius = '5px';
    watermarkDiv.style.fontSize = '12px';
    watermarkDiv.style.fontFamily = 'Arial, sans-serif';
    watermarkDiv.style.zIndex = '9999';
    watermarkDiv.style.pointerEvents = 'none';
    watermarkDiv.textContent = watermarkText;
    
    document.body.appendChild(watermarkDiv);
    document.body.appendChild(link);
    
    link.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(link);
      document.body.removeChild(watermarkDiv);
    }, 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Notes</h2>
        <div className="flex gap-2">
          <Badge variant="outline">Batch: {profile?.batch}</Badge>
          <Badge variant="outline">Subjects: {profile?.subjects?.join(', ')}</Badge>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedSubject} onValueChange={(value) => setSelectedSubject(value === 'all' ? undefined : value)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {profile?.subjects?.map((subject) => (
              <SelectItem key={subject} value={subject}>{subject}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4">
        {filteredNotes && filteredNotes.length > 0 ? (
          filteredNotes.map((note) => (
            <Card key={note.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">{note.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{note.filename}</p>
                    <div className="flex gap-2">
                      <Badge variant="outline">{note.subject}</Badge>
                      <Badge variant="outline">{note.batch}</Badge>
                      {note.tags && note.tags.length > 0 && (
                        note.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary">{tag}</Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <Button onClick={() => handleDownload(note)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No notes found for your batch and subjects</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
