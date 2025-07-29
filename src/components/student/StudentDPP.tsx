import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, ExternalLink, Search, Target } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

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

const DPPSkeleton = () => (
  <div className="space-y-4">
    {[...Array(3)].map((_, i) => (
      <Card key={i} className="p-4">
        <div className="flex justify-between items-center">
          <div className="space-y-3 flex-grow">
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-4 w-4/5" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
          <Skeleton className="h-10 w-28" />
        </div>
      </Card>
    ))}
  </div>
);

export const StudentDPP = () => {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');

  const { data: dppContent, isLoading } = useQuery({
    queryKey: ['student-dpp'],
    queryFn: async (): Promise<DPPContent[]> => {
      const { data, error } = await supabase
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
    
    const matchesSubject = selectedSubject === 'all' || dpp.subject === selectedSubject;
    
    return matchesSearch && matchesSubject;
  });

  const handleOpenDPP = (dpp: DPPContent) => {
    window.open(dpp.link, '_blank');
  };

  return (
    <div className="p-6 space-y-8 bg-gray-50/50 min-h-full">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            <Target className="mr-3 h-8 w-8 text-primary" />
            DPP Section
          </h1>
          <p className="text-gray-500 mt-1">Daily Practice Problems to sharpen your skills.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">Batch: {profile?.batch}</Badge>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search DPP by title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
          <SelectTrigger className="w-48 h-10">
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

      {/* DPP List */}
      <div>
        {isLoading ? (
          <DPPSkeleton />
        ) : filteredDPP && filteredDPP.length > 0 ? (
          <div className="space-y-4">
            {filteredDPP.map((dpp) => (
              <Card key={dpp.id} className="bg-white hover:shadow-md transition-shadow duration-300">
                <CardContent className="p-5 flex justify-between items-center">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                       <BookOpen className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-gray-800">{dpp.title}</h3>
                    </div>
                    {dpp.description && (
                      <p className="text-sm text-muted-foreground mb-3 pl-8">{dpp.description}</p>
                    )}
                    <div className="flex gap-2 pl-8">
                      <Badge variant="outline">{dpp.subject}</Badge>
                      <Badge variant="secondary">{dpp.batch}</Badge>
                      {dpp.difficulty && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{dpp.difficulty}</Badge>
                      )}
                    </div>
                  </div>
                  <Button onClick={() => handleOpenDPP(dpp)}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open DPP
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-lg border-dashed border-2">
            <Target className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700">No DPPs Available</h3>
            <p className="text-muted-foreground mt-2">New practice problems will be added soon. Keep an eye out!</p>
          </div>
        )}
      </div>
    </div>
  );
};
