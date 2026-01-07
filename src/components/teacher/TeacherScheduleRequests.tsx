import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Clock, Calendar, CheckCircle, XCircle, Loader2, ArrowRight, AlertCircle, Info } from 'lucide-react';
import { format, isSameDay } from 'date-fns';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const TeacherScheduleRequests = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // State for the wizard-like flow
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>('');
  const [formData, setFormData] = useState({
    new_date: '',
    new_start_time: '',
    new_end_time: '',
    reason: ''
  });

  // Real-time listener
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

  // 1. Fetch Teacher Info
  const { data: teacherInfo, isLoading: isLoadingTeacher } = useQuery({
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

  // 2. Fetch Teacher's Existing Schedules 
  // FIX: Fetch by BATCH only. Do NOT filter by subject strictly, so "Maths 1" shows up even if assigned "Maths".
  const { data: mySchedules, isLoading: isLoadingSchedules } = useQuery({
    queryKey: ['teacherSchedules', teacherInfo?.id],
    queryFn: async () => {
      if (!teacherInfo) return [];

      const batches = teacherInfo.assigned_batches || [];

      if (batches.length === 0) {
        console.log('Teacher has no assigned batches');
        return [];
      }
      
      // Fetch ALL schedules for the teacher's batches
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .in('batch', batches)
        .order('date', { ascending: true }) // Show dated classes (like today's) first
        .order('day_of_week')
        .order('start_time');

      if (error) {
        console.error('Error fetching schedules:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!teacherInfo
  });

  // 3. Fetch Previous Requests
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

  // 4. Create Request Mutation
  const createRequest = useMutation({
    mutationFn: async () => {
      if (!teacherInfo?.id || !selectedScheduleId) throw new Error('Missing info');
      
      const selectedClass = mySchedules?.find(s => s.id === selectedScheduleId);
      
      if (!selectedClass) throw new Error('Invalid class selected');

      // Validation: Warning instead of Block? 
      // We'll allow it but log a warning if subject doesn't match exactly.
      const isAssignedSubject = teacherInfo.assigned_subjects?.some(
        s => selectedClass.subject.toLowerCase().includes(s.toLowerCase()) || 
             s.toLowerCase().includes(selectedClass.subject.toLowerCase())
      );

      if (!isAssignedSubject) {
        console.warn("Subject mismatch warning: Teacher attempting to move a class that might not be theirs.");
        // We allow it to proceed because naming conventions (Maths vs Maths 1) are common issues.
      }

      const { error } = await supabase
        .from('schedule_requests')
        .insert({
          requested_by: teacherInfo.id,
          schedule_id: selectedScheduleId,
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
      toast.success('Reschedule request submitted');
      setIsDialogOpen(false);
      setFormData({ new_date: '', new_start_time: '', new_end_time: '', reason: '' });
      setSelectedScheduleId('');
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
    let dayStr = '';
    
    // Check if it's a specific date
    if (schedule.date) {
      const dateObj = new Date(schedule.date);
      dayStr = format(dateObj, 'MMM d (EEE)');
      if (isSameDay(dateObj, new Date())) {
        dayStr = 'Today';
      }
    } else {
      dayStr = DAYS[schedule.day_of_week];
    }

    return `${schedule.subject} (${schedule.batch}) - ${dayStr} at ${time}`;
  };

  const isLoading = isLoadingTeacher || isLoadingRequests;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">My Schedule Requests</h2>
          <p className="text-muted-foreground">Propose timing changes for your existing classes</p>
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
              
              {/* Step 1: Select Existing Class */}
              <div className="space-y-2">
                <Label>Select Class</Label>
                {isLoadingSchedules ? (
                   <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading batch schedules...
                   </div>
                ) : mySchedules && mySchedules.length > 0 ? (
                  <Select value={selectedScheduleId} onValueChange={setSelectedScheduleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a class to reschedule..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {mySchedules.map((schedule) => (
                        <SelectItem key={schedule.id} value={schedule.id}>
                          {getScheduleLabel(schedule)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md flex items-start gap-2 border border-amber-200">
                      <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold">No classes found for your batches.</p>
                        <p className="mt-1">We couldn't find any schedule entries for batches: {teacherInfo?.assigned_batches?.join(', ')}.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Show form only if class selected */}
              {selectedScheduleId && (
                <div className="space-y-4 border-t pt-4 animate-in slide-in-from-top-2 fade-in">
                  <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-700 mb-2 border border-blue-100">
                    <span className="font-semibold">Selected:</span> {getScheduleLabel(mySchedules?.find(s => s.id === selectedScheduleId))}
                  </div>

                  <div className="space-y-2">
                    <Label>Proposed Date</Label>
                    <Input 
                      type="date" 
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
                      placeholder="Why is this change needed?"
                      className="resize-none h-20"
                    />
                  </div>
                  
                  <Button onClick={() => createRequest.mutate()} disabled={createRequest.isPending} className="w-full">
                    {createRequest.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Submit Proposal
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
          {requests.map((request) => (
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
