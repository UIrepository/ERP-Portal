import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Clock, Calendar, CheckCircle, XCircle, Loader2, ArrowRight, Filter, AlertCircle } from 'lucide-react';
import { format, isSameDay, parseISO, getDay } from 'date-fns';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const TeacherScheduleRequests = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // State for the wizard-like flow to ensure we capture the schedule_id
  const [filterDate, setFilterDate] = useState<string>(''); // Date Filter State
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  const [formData, setFormData] = useState({
    new_date: '',
    new_start_time: '',
    new_end_time: '',
    reason: ''
  });

  // Real-time listener for status updates
  useEffect(() => {
    const channel = supabase
      .channel('teacher-schedule-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedule_requests' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['teacherScheduleRequests'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch teacher info to get assigned batches and subjects
  const { data: teacherInfo } = useQuery({
    queryKey: ['teacherInfo', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Fetch Teacher's Existing Schedules to populate the dropdown
  const { data: mySchedules, isLoading: isLoadingSchedules } = useQuery({
    queryKey: ['teacherSchedules', teacherInfo?.id],
    queryFn: async () => {
      if (!teacherInfo) return [];

      const batches = teacherInfo.assigned_batches || [];

      if (batches.length === 0) {
        return [];
      }
      
      // Fetch ALL schedules for the teacher's batches
      // We will filter them in the UI based on the selected date
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .in('batch', batches)
        .order('start_time');

      if (error) throw error;
      
      return data || [];
    },
    enabled: !!teacherInfo
  });

  // Helper: Filter Schedules by Selected Date for the dropdown
  const getFilteredSchedules = () => {
    if (!mySchedules || !filterDate) return [];

    const selectedDateObj = parseISO(filterDate);
    const selectedDayOfWeek = getDay(selectedDateObj); // 0 = Sunday, 1 = Monday...

    return mySchedules.filter(schedule => {
      // Case A: Specific Date Schedule (e.g., Extra Class, Exam)
      if (schedule.date) {
        return isSameDay(parseISO(schedule.date), selectedDateObj);
      }
      // Case B: Recurring Schedule (Weekly)
      // Show if the day_of_week matches the selected date's day
      return schedule.day_of_week === selectedDayOfWeek;
    });
  };

  const filteredSchedules = getFilteredSchedules();

  // Fetch Previous Requests
  const { data: requests, isLoading: isLoadingRequests } = useQuery({
    queryKey: ['teacherScheduleRequests', teacherInfo?.id],
    queryFn: async () => {
      if (!teacherInfo?.id) return [];
      const { data, error } = await supabase
        .from('schedule_requests')
        .select('*')
        .eq('requested_by', teacherInfo.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!teacherInfo?.id
  });

  // Create Request Mutation
  const createRequest = useMutation({
    mutationFn: async () => {
      if (!teacherInfo?.id) throw new Error('Teacher info not found');
      if (!selectedScheduleId) throw new Error('Please select a class to reschedule');
      
      // Find the full schedule object based on the ID selected
      const selectedClass = mySchedules?.find(s => s.id === selectedScheduleId);
      
      if (!selectedClass) throw new Error('Invalid class selected');

      // CRITICAL FIX: Include schedule_id in the insert so managers can update it later
      const { error } = await supabase
        .from('schedule_requests')
        .insert({
          requested_by: teacherInfo.id,
          schedule_id: selectedScheduleId, // This links the request to the specific class
          batch: selectedClass.batch,
          subject: selectedClass.subject,
          new_date: formData.new_date,
          new_start_time: formData.new_start_time,
          new_end_time: formData.new_end_time,
          reason: formData.reason,
          status: 'pending'
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacherScheduleRequests'] });
      toast.success('Schedule request submitted successfully');
      setIsDialogOpen(false);
      // Reset form
      setFormData({ new_date: '', new_start_time: '', new_end_time: '', reason: '' });
      setSelectedScheduleId('');
      setFilterDate(''); // Reset filter
    },
    onError: (error) => {
      toast.error('Failed to submit request');
      console.error(error);
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const getScheduleLabel = (schedule: any) => {
    const time = `${schedule.start_time.slice(0, 5)} - ${schedule.end_time.slice(0, 5)}`;
    return `${schedule.subject} (${schedule.batch}) | ${time}`;
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  if (isLoadingRequests) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">My Schedule Requests</h2>
          <p className="text-muted-foreground">Propose timing changes for your upcoming classes</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Reschedule Class</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request Schedule Change</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              
              {/* Step 1: Filter by Date */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-primary" />
                  Select Class Date
                </Label>
                <div className="flex gap-2">
                   <Input 
                      type="date" 
                      min={todayStr}
                      value={filterDate} 
                      onChange={(e) => {
                        setFilterDate(e.target.value);
                        setSelectedScheduleId(''); // Reset selection when date changes
                      }}
                      className="flex-1"
                    />
                </div>
                {!filterDate && (
                  <p className="text-xs text-muted-foreground">Please select the date of the class you want to reschedule.</p>
                )}
              </div>

              {/* Step 2: Select Class (Filtered) */}
              {filterDate && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                  <Label>Select Class to Move</Label>
                  {filteredSchedules.length > 0 ? (
                    <Select value={selectedScheduleId} onValueChange={setSelectedScheduleId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select class..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredSchedules.map((schedule) => (
                          <SelectItem key={schedule.id} value={schedule.id}>
                            {getScheduleLabel(schedule)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md flex items-start gap-2 border border-amber-200">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>No classes found for {format(parseISO(filterDate), 'MMM d, yyyy')}.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Show form only if class selected */}
              {selectedScheduleId && (
                <div className="space-y-4 border-t pt-4 animate-in slide-in-from-top-2 fade-in">
                  <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-700 mb-2 border border-blue-100">
                     <span className="font-semibold">Rescheduling:</span> {mySchedules?.find(s => s.id === selectedScheduleId)?.subject}
                  </div>

                  <div className="space-y-2">
                    <Label>New Proposed Date</Label>
                    <Input 
                      type="date" 
                      min={todayStr}
                      value={formData.new_date} 
                      onChange={(e) => setFormData(prev => ({ ...prev, new_date: e.target.value }))} 
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>New Start Time</Label>
                      <Input 
                        type="time" 
                        value={formData.new_start_time} 
                        onChange={(e) => setFormData(prev => ({ ...prev, new_start_time: e.target.value }))} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>New End Time</Label>
                      <Input 
                        type="time" 
                        value={formData.new_end_time} 
                        onChange={(e) => setFormData(prev => ({ ...prev, new_end_time: e.target.value }))} 
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Textarea 
                      value={formData.reason} 
                      onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))} 
                      placeholder="Why do you need to reschedule this class?"
                      className="resize-none h-20"
                    />
                  </div>
                  
                  <Button onClick={() => createRequest.mutate()} disabled={createRequest.isPending} className="w-full">
                    {createRequest.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Submit Request
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!requests?.length ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">You haven't made any requests yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request: any) => (
            <Card key={request.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{request.subject}</h3>
                      <Badge variant="outline">{request.batch}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>Proposed:</span>
                      <ArrowRight className="h-3 w-3" />
                      <span>{format(new Date(request.new_date), 'MMM d, yyyy')} • {request.new_start_time} - {request.new_end_time}</span>
                    </div>
                    {request.reason && (
                      <p className="text-sm text-foreground/80 mt-1 italic">"{request.reason}"</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                     {getStatusBadge(request.status || 'pending')}
                     {request.status !== 'pending' && (
                        <span className="text-xs text-muted-foreground">Reviewed {request.reviewed_at ? format(new Date(request.reviewed_at), 'MMM d') : ''}</span>
                     )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
