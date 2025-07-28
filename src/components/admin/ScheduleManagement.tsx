
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
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' }
  ];

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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Select value={newSchedule.subject} onValueChange={(value) => setNewSchedule({ ...newSchedule, subject: value })}>
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
                    <Select value={newSchedule.batch} onValueChange={(value) => setNewSchedule({ ...newSchedule, batch: value })}>
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
                  <Label htmlFor="day_of_week">Day of Week</Label>
                  <Select value={newSchedule.day_of_week.toString()} onValueChange={(value) => setNewSchedule({ ...newSchedule, day_of_week: parseInt(value) })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {dayOptions.map((day) => (
                        <SelectItem key={day.value} value={day.value.toString()}>{day.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_time">Start Time</Label>
                    <Input
                      id="start_time"
                      type="time"
                      value={newSchedule.start_time}
                      onChange={(e) => setNewSchedule({ ...newSchedule, start_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_time">End Time</Label>
                    <Input
                      id="end_time"
                      type="time"
                      value={newSchedule.end_time}
                      onChange={(e) => setNewSchedule({ ...newSchedule, end_time: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="link">Class Link</Label>
                  <Input
                    id="link"
                    value={newSchedule.link}
                    onChange={(e) => setNewSchedule({ ...newSchedule, link: e.target.value })}
                    placeholder="Enter class link"
                  />
                </div>
                <Button onClick={handleAddSchedule} className="w-full">
                  Add Schedule
                </Button>
              </TabsContent>
              
              <TabsContent value="extra" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Select value={newSchedule.subject} onValueChange={(value) => setNewSchedule({ ...newSchedule, subject: value })}>
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
                    <Select value={newSchedule.batch} onValueChange={(value) => setNewSchedule({ ...newSchedule, batch: value })}>
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
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={newSchedule.date}
                    onChange={(e) => setNewSchedule({ ...newSchedule, date: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start_time">Start Time</Label>
                    <Input
                      id="start_time"
                      type="time"
                      value={newSchedule.start_time}
                      onChange={(e) => setNewSchedule({ ...newSchedule, start_time: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end_time">End Time</Label>
                    <Input
                      id="end_time"
                      type="time"
                      value={newSchedule.end_time}
                      onChange={(e) => setNewSchedule({ ...newSchedule, end_time: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="link">Class Link</Label>
                  <Input
                    id="link"
                    value={newSchedule.link}
                    onChange={(e) => setNewSchedule({ ...newSchedule, link: e.target.value })}
                    placeholder="Enter class link"
                  />
                </div>
                <div>
                  <Label htmlFor="reason">Reason (Optional)</Label>
                  <Input
                    id="reason"
                    value={newSchedule.reason}
                    onChange={(e) => setNewSchedule({ ...newSchedule, reason: e.target.value })}
                    placeholder="Enter reason for extra class"
                  />
                </div>
                <Button onClick={handleAddSchedule} className="w-full">
                  Add Extra Class
                </Button>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="regular">Regular Schedule</TabsTrigger>
          <TabsTrigger value="extra">Extra Classes</TabsTrigger>
        </TabsList>
        
        <TabsContent value="regular" className="space-y-4">
          <div className="grid gap-4">
            {schedules.map((schedule) => (
              <Card key={schedule.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{schedule.subject}</h3>
                      <p className="text-sm text-muted-foreground">
                        {dayOptions.find(d => d.value === schedule.day_of_week)?.label} - 
                        {schedule.start_time} to {schedule.end_time}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs bg-primary/10 px-2 py-1 rounded">{schedule.batch}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm">
                        <Calendar className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="extra" className="space-y-4">
          <div className="grid gap-4">
            {extraClasses.map((extraClass) => (
              <Card key={extraClass.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{extraClass.subject}</h3>
                      <p className="text-sm text-muted-foreground">
                        {extraClass.date} - {extraClass.start_time} to {extraClass.end_time}
                      </p>
                      {extraClass.reason && (
                        <p className="text-xs text-muted-foreground mt-1">Reason: {extraClass.reason}</p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <span className="text-xs bg-primary/10 px-2 py-1 rounded">{extraClass.batch}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm">
                        <Clock className="h-4 w-4" />
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
