import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, User, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const AdminFeedbackViewer = () => {
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');

  const { data: feedback } = useQuery({
    queryKey: ['admin-feedback'],
    queryFn: async () => {
      const { data } = await supabase
        .from('feedback')
        .select(`
          *,
          profiles!feedback_submitted_by_fkey (
            name,
            email
          )
        `)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { allBatches, allSubjects, groupedFeedback } = useMemo(() => {
    const allBatches = new Set<string>();
    const allSubjects = new Set<string>();
    feedback?.forEach(f => {
      allBatches.add(f.batch);
      allSubjects.add(f.subject);
    });

    const filtered = feedback?.filter(f =>
      (selectedBatch === 'all' || f.batch === selectedBatch) &&
      (selectedSubject === 'all' || f.subject === selectedSubject)
    );

    const groupedFeedback = filtered?.reduce((acc, item) => {
      const key = `${item.subject}-${item.batch}`;
      if (!acc[key]) {
        acc[key] = {
          subject: item.subject,
          batch: item.batch,
          feedback: [],
        };
      }
      acc[key].feedback.push(item);
      return acc;
    }, {} as Record<string, any>);
    
    return {
      allBatches: Array.from(allBatches),
      allSubjects: Array.from(allSubjects),
      groupedFeedback,
    };
  }, [feedback, selectedBatch, selectedSubject]);

  return (
    <div className="space-y-6">
      {/* Header and filters */}
      <div className="flex gap-4">
        <Select value={selectedBatch} onValueChange={setSelectedBatch}>
          <SelectTrigger><SelectValue placeholder="Filter by Batch" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Batches</SelectItem>
            {allBatches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
          <SelectTrigger><SelectValue placeholder="Filter by Subject" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {allSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-6">
        {/* Feedback cards */}
      </div>
    </div>
  );
};
