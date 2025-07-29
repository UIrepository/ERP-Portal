import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Plus, Calendar, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export const ScheduleManagement = () => {
  const [activeTab, setActiveTab] = useState('regular');
  const [isAddScheduleOpen, setIsAddScheduleOpen] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    subject: '',
    batch: '',
    day_of_week: 0,
    start_time: '',
    end_time: '',
    link: '',
    date: '',
    reason: ''
  });
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedDay, setSelectedDay] = useState('all');

  const queryClient = useQueryClient();

  const { data: schedules = [] } = useQuery({
    queryKey: ['admin-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .order('day_of_week', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: extraClasses = [] } = useQuery({
    queryKey: ['admin-extra-classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('extra_classes')
        .select('*')
        .order('date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  const addScheduleMutation = useMutation({
    mutationFn: async (scheduleData: any) => {
      const { error } = await supabase
        .from('schedules')
        .insert([scheduleData]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-schedules'] });
      setIsAddScheduleOpen(false);
      resetForm();
      toast({
        title: 'Success',
        description: 'Schedule added successfully',
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

  const addExtraClassMutation = useMutation({
    mutationFn: async (classData: any) => {
      const { error } = await supabase
        .from('extra_classes')
        .insert([classData]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-extra-classes'] });
      setIsAddScheduleOpen(false);
      resetForm();
      toast({
        title: 'Success',
        description: 'Extra class added successfully',
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
    setNewSchedule({
      subject: '',
      batch: '',
      day_of_week: 0,
      start_time: '',
      end_time: '',
      link: '',
      date: '',
      reason: ''
    });
  };

  const handleAddSchedule = () => {
    if (activeTab === 'regular') {
      addScheduleMutation.mutate({
        subject: newSchedule.subject,
        batch: newSchedule.batch,
        day_of_week: newSchedule.day_of_week,
        start_time: newSchedule.start_time,
        end_time: newSchedule.end_time,
        link: newSchedule.link
      });
    } else {
      addExtraClassMutation.mutate({
        subject: newSchedule.subject,
        batch: newSchedule.batch,
        date: newSchedule.date,
        start_time: newSchedule.start_time,
        end_time: newSchedule.end_time,
        link: newSchedule.link,
        reason: newSchedule.reason
      });
    }
  };

  const subjectOptions = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Computer Science'];
  const batchOptions = ['2024-A', '2024-B', '2025-A', '2025-B'];
  const dayOptions = [
    { value: 'all', label: 'All Days' },
    { value: '0', label: 'Sunday' },
    { value: '1', label: 'Monday' },
    { value: '2', label: 'Tuesday' },
    { value: '3', label: 'Wednesday' },
    { value: '4', label: 'Thursday' },
    { value: '5', label: 'Friday' },
    { value: '6', label: 'Saturday' }
  ];

  const filteredSchedules = schedules.filter(s => 
    (selectedBatch === 'all' || s.batch === selectedBatch) &&
    (selectedDay === 'all' || s.day_of_week === parseInt(selectedDay))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Schedule Management</h2>
        <Dialog open={isAddScheduleOpen} onOpenChange={setIsAddScheduleOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Schedule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Schedule</DialogTitle>
            </DialogHeader>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="regular">Regular Schedule</TabsTrigger>
                <TabsTrigger value="extra">Extra Class</TabsTrigger>
              </TabsList>
              
              <TabsContent value="regular" className="space-y-4">
                {/* Form fields... */}
              </TabsContent>
              
              <TabsContent value="extra" className="space-y-4">
                {/* Form fields... */}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex gap-4">
        <Select value={selectedBatch} onValueChange={setSelectedBatch}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by Batch" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Batches</SelectItem>
            {batchOptions.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedDay} onValueChange={setSelectedDay}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by Day" />
          </SelectTrigger>
          <SelectContent>
            {dayOptions.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Tabs content... */}
      </Tabs>
    </div>
  );
};
