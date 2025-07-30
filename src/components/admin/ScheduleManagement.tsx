import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { CalendarPlus, Trash2, Edit, Clock } from 'lucide-react';
import { format } from 'date-fns';

const DAYS_OF_WEEK = [
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
  { id: 6, name: 'Saturday' },
  { id: 0, name: 'Sunday' },
];

export const ScheduleManagement = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);

  const { data: schedules = [], isLoading: isLoadingSchedules } = useQuery<any[]>({
    queryKey: ['schedules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('schedules').select('*').order('day_of_week').order('start_time');
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const { data: options = [] } = useQuery({
    queryKey: ['available-options-schedule'],
    queryFn: async () => {
        const { data } = await supabase.rpc('get_all_options');
        return data || [];
    }
  });

  const { batchOptions, subjectOptions } = useMemo(() => ({
    batchOptions: options.filter((o: any) => o.type === 'batch').map((o: any) => o.name),
    subjectOptions: options.filter((o: any) => o.type === 'subject').map((o: any) => o.name)
  }), [options]);

  const scheduleMutation = useMutation({
    mutationFn: async (newSchedule: any) => {
      const { id, ...scheduleData } = newSchedule;
      let response;
      if (id) {
        response = await supabase.from('schedules').update(scheduleData).eq('id', id).select();
      } else {
        response = await supabase.from('schedules').insert(scheduleData).select();
      }
      const { data, error } = response;
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({ title: 'Success', description: `Schedule ${editingSchedule ? 'updated' : 'created'} successfully.` });
      setIsDialogOpen(false);
      setEditingSchedule(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast({ title: 'Success', description: 'Schedule deleted successfully.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    const scheduleData = {
      ...data,
      day_of_week: Number(data.day_of_week),
      id: editingSchedule?.id,
    };
    scheduleMutation.mutate(scheduleData);
  };
  
  const handleEditClick = (schedule: any) => {
    setEditingSchedule(schedule);
    setIsDialogOpen(true);
  };

  const groupedSchedules = useMemo(() => {
    return schedules.reduce((acc, schedule) => {
      const dayName = DAYS_OF_WEEK.find(d => d.id === schedule.day_of_week)?.name || 'Unknown Day';
      if (!acc[dayName]) {
        acc[dayName] = [];
      }
      acc[dayName].push(schedule);
      return acc;
    }, {} as Record<string, any[]>);
  }, [schedules]);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Manage Schedules</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingSchedule(null)}>
              <CalendarPlus className="mr-2 h-4 w-4" /> Create Schedule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSchedule ? 'Edit' : 'Create'} Schedule</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label>Batch</label>
                <Select name="batch" defaultValue={editingSchedule?.batch}>
                  <SelectTrigger><SelectValue placeholder="Select a batch" /></SelectTrigger>
                  <SelectContent>
                    {batchOptions.map((batch: string) => <SelectItem key={batch} value={batch}>{batch}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label>Subject</label>
                <Select name="subject" defaultValue={editingSchedule?.subject}>
                  <SelectTrigger><SelectValue placeholder="Select a subject" /></SelectTrigger>
                  <SelectContent>
                    {subjectOptions.map((subject: string) => <SelectItem key={subject} value={subject}>{subject}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label>Day of the Week</label>
                <Select name="day_of_week" defaultValue={String(editingSchedule?.day_of_week)}>
                  <SelectTrigger><SelectValue placeholder="Select a day" /></SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map(day => <SelectItem key={day.id} value={String(day.id)}>{day.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label>Start Time</label>
                  <Input name="start_time" type="time" defaultValue={editingSchedule?.start_time} />
                </div>
                <div>
                  <label>End Time</label>
                  <Input name="end_time" type="time" defaultValue={editingSchedule?.end_time} />
                </div>
              </div>
              <div>
                <label>Meeting Link</label>
                <Input name="link" placeholder="https://zoom.us/j/..." defaultValue={editingSchedule?.link} />
              </div>
              <Button type="submit" disabled={scheduleMutation.isPending}>
                {editingSchedule ? 'Update' : 'Create'} Schedule
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoadingSchedules ? (
          <p>Loading schedules...</p>
        ) : (
          Object.entries(groupedSchedules).map(([day, daySchedules]) => (
            <Card key={day}>
              <CardHeader>
                <CardTitle>{day}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {daySchedules.map(schedule => (
                  <div key={schedule.id} className="p-3 rounded-md border bg-muted/20">
                    <div className="font-bold">{schedule.subject}</div>
                    <div className="text-sm text-muted-foreground">{schedule.batch}</div>
                    <div className="flex items-center text-sm mt-2">
                        <Clock className="h-4 w-4 mr-2" />
                        {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                    </div>
                    <div className="flex justify-end gap-2 mt-2">
                      <Button variant="outline" size="icon" onClick={() => handleEditClick(schedule)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => deleteMutation.mutate(schedule.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
