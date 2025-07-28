
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, ExternalLink, Search } from 'lucide-react';

interface DPPContent {
  id: string;
  title: string;
  description?: string;
  subject: string;
  batch: string;
  difficulty?: string;
  link: string;
  created_at: string;
}

export const StudentDPP = () => {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  const { data: dppContent } = useQuery({
    queryKey: ['student-dpp'],
    queryFn: async (): Promise<DPPContent[]> => {
      const { data, error } = await (supabase as any)
        .from('dpp_content')
        .select('*')
        .eq('batch', profile?.batch)
        .in('subject', profile?.subjects || [])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as DPPContent[];
    },
    enabled: !!profile?.batch && !!profile?.subjects
  });

  const filteredDPP = dppContent?.filter(dpp => {
    const matchesSearch = !searchTerm || 
      dpp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dpp.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSubject = !selectedSubject || dpp.subject === selectedSubject;
    
    return matchesSearch && matchesSubject;
  });

  const handleOpenDPP = (dpp: DPPContent) => {
    window.open(dpp.link, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">📚 DPP Section</h2>
        <div className="flex gap-2">
          <Badge variant="outline">Batch: {profile?.batch}</Badge>
          <Badge variant="outline">Subjects: {profile?.subjects?.join(', ')}</Badge>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search DPP..."
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
        {filteredDPP && filteredDPP.length > 0 ? (
          filteredDPP.map((dpp) => (
            <Card key={dpp.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">{dpp.title}</h3>
                    </div>
                    {dpp.description && (
                      <p className="text-sm text-muted-foreground mb-3">{dpp.description}</p>
                    )}
                    <div className="flex gap-2">
                      <Badge variant="outline">{dpp.subject}</Badge>
                      <Badge variant="outline">{dpp.batch}</Badge>
                      {dpp.difficulty && (
                        <Badge variant="secondary">{dpp.difficulty}</Badge>
                      )}
                    </div>
                  </div>
                  <Button onClick={() => handleOpenDPP(dpp)}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open DPP
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No DPP content available for your batch and subjects</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
