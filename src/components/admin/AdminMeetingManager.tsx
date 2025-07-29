import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link, Save, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const AdminMeetingManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [newLink, setNewLink] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  
  const { data: schedules } = useQuery({
    queryKey: ['admin-meeting-schedules'],
    queryFn: async () => {
      const { data } = await supabase
        .from('schedules')
        .select('*')
        .order('batch', { ascending: true });
      return data || [];
    },
  });

  const { allBatches, allSubjects, groupedSchedules } = useMemo(() => {
    const allBatches = new Set<string>();
    const allSubjects = new Set<string>();
    schedules?.forEach(s => {
      allBatches.add(s.batch);
      allSubjects.add(s.subject);
    });

    const filtered = schedules?.filter(s =>
      (selectedBatch === 'all' || s.batch === selectedBatch) &&
      (selectedSubject === 'all' || s.subject === selectedSubject)
    );

    const groupedSchedules = filtered?.reduce((acc, schedule) => {
      const key = `${schedule.batch}-${schedule.subject}`;
      if (!acc[key]) {
        acc[key] = {
          batch: schedule.batch,
          subject: schedule.subject,
          schedules: [],
        };
      }
      acc[key].schedules.push(schedule);
      return acc;
    }, {} as Record<string, any>);
    
    return {
      allBatches: Array.from(allBatches),
      allSubjects: Array.from(allSubjects),
      groupedSchedules,
    };
  }, [schedules, selectedBatch, selectedSubject]);

  const updateLinkMutation = useMutation({
    mutationFn: async ({ id, link }: { id: string; link: string }) => {
      const { error } = await supabase
        .from('schedules')
        .update({ link })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-meeting-schedules'] });
      toast({ title: "Success", description: "Meeting link updated successfully" });
      setEditingSchedule(null);
      setNewLink('');
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to update meeting link", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!editingSchedule || !newLink) return;
    
    updateLinkMutation.mutate({
      id: editingSchedule.id,
      link: newLink,
    });
  };

  const startEditing = (schedule: any) => {
    setEditingSchedule(schedule);
    setNewLink(schedule.link || '');
  };

  const getDayName = (dayNumber: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNumber] || 'Unknown';
  };

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Batch + Subject Groups */}
        <Card>
          {/* Card content */}
        </Card>

        {/* Edit Form */}
        {editingSchedule && (
          <Card>
            {/* Card content */}
          </Card>
        )}
      </div>
    </div>
  );
};
