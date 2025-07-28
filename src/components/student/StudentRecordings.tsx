import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Video, Play, Search, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';

export const StudentRecordings = () => {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedRecording, setSelectedRecording] = useState<any>(null);

  const { data: recordings } = useQuery({
    queryKey: ['student-recordings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('recordings')
        .select('*')
        .eq('batch', profile?.batch)
        .in('subject', profile?.subjects || [])
        .order('date', { ascending: false });
      return data || [];
    },
    enabled: !!profile?.batch && !!profile?.subjects
  });

  const filteredRecordings = recordings?.filter(recording => {
    const matchesSearch = !searchTerm || 
      recording.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recording.subject.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSubject = !selectedSubject || recording.subject === selectedSubject;
    
    return matchesSearch && matchesSubject;
  });

  const handleWatchRecording = (recording: any) => {
    setSelectedRecording(recording);
  };

  const WatermarkedPlayer = ({ recording }: { recording: any }) => {
    return (
      <div className="relative">
        <div className="watermark-overlay">
          <div className="watermark-text">
            {profile?.name} - {profile?.email}
          </div>
        </div>
        
        <div 
          className="recording-player"
          style={{
            position: 'relative',
            width: '100%',
            height: '400px',
            backgroundColor: '#000',
            borderRadius: '8px',
            overflow: 'hidden'
          }}
        >
          <iframe
            src={recording.embed_link}
            width="100%"
            height="100%"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ 
              pointerEvents: 'auto',
              border: 'none'
            }}
          />
        </div>
        
        <style>{`
          .watermark-overlay {
            position: absolute;
            top: 20px;
            right: 20px;
            z-index: 1000;
            pointer-events: none;
          }
          
          .watermark-text {
            background: rgba(0, 0, 0, 0.1);
            color: rgba(255, 255, 255, 0.7);
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-family: Arial, sans-serif;
            backdrop-filter: blur(2px);
          }
        `}</style>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Recordings</h2>
        <div className="flex gap-2">
          <Badge variant="outline">Batch: {profile?.batch}</Badge>
          <Badge variant="outline">Subjects: {profile?.subjects?.join(', ')}</Badge>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search recordings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Subjects</SelectItem>
            {profile?.subjects?.map((subject) => (
              <SelectItem key={subject} value={subject}>{subject}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4">
        {filteredRecordings && filteredRecordings.length > 0 ? (
          filteredRecordings.map((recording) => (
            <Card key={recording.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Video className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">{recording.topic}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {format(new Date(recording.date), 'PPP')}
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="outline">{recording.subject}</Badge>
                      <Badge variant="outline">{recording.batch}</Badge>
                    </div>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button onClick={() => handleWatchRecording(recording)}>
                        <Play className="h-4 w-4 mr-2" />
                        Watch
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl">
                      <DialogHeader>
                        <DialogTitle>{recording.topic}</DialogTitle>
                      </DialogHeader>
                      <WatermarkedPlayer recording={recording} />
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No recordings found for your batch and subjects</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
