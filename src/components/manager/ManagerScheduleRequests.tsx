import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock, Calendar, User, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

export const ManagerScheduleRequests = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('manager-schedule-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedule_requests' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['managerScheduleRequests'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: managerInfo } = useQuery({
    queryKey: ['managerInfo', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('managers')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const { data: requests, isLoading } = useQuery({
    queryKey: ['managerScheduleRequests', managerInfo?.assigned_batches],
    queryFn: async () => {
      if (!managerInfo?.assigned_batches?.length) return [];
      const { data, error } = await supabase
        .from('schedule_requests')
        .select(`
          *,
          teachers:requested_by (name, email)
        `)
        .in('batch', managerInfo.assigned_batches)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!managerInfo
  });

  // Dual-update mutation
  const handleRequest = useMutation({
    mutationFn: async ({ request, status }: { request: any; status: 'approved' | 'rejected' }) => {
      
      // If approving, we MUST update the actual schedule table
      if (status === 'approved' && request.schedule_id) {
        // 1. Update the actual schedule
        const { error: scheduleError } = await supabase
          .from('schedules')
          .update({
            date: request.new_date,
            start_time: request.new_start_time,
            end_time: request.new_end_time,
            // Calculate new day of week from date
            day_of_week: new Date(request.new_date).getDay()
          })
          .eq('id', request.schedule_id);
          
        if (scheduleError) {
            console.error("Schedule Update Failed", scheduleError);
            throw new Error('Failed to update the class schedule');
        }
      }

      // 2. Update the request status
      const { error } = await supabase
        .from('schedule_requests')
        .update({ 
          status, 
          reviewed_by: user?.id, 
          reviewed_at: new Date().toISOString() 
        })
        .eq('id', request.id);
        
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['managerScheduleRequests'] });
      // Also invalidate schedules so everyone sees the change immediately
      queryClient.invalidateQueries({ queryKey: ['admin-all-schedules'] }); 
      toast.success(`Request ${status} and schedule updated if approved`);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to process request');
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Schedule Requests</h2>
        <p className="text-muted-foreground">Review and manage schedule change requests from teachers</p>
      </div>

      {!requests?.length ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No pending schedule requests.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request: any) => (
            <Card key={request.id} className={request.status === 'pending' ? 'border-l-4 border-l-yellow-400' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{request.subject}</h3>
                      <Badge variant="outline">{request.batch}</Badge>
                      {getStatusBadge(request.status || 'pending')}
                    </div>
                    
                    <div className="text-sm text-muted-foreground space-y-1">
                        <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>Teacher: {request.teachers?.name || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>New Proposal: </span>
                            <span className="font-medium text-foreground">{format(new Date(request.new_date), 'MMM d, yyyy')} • {request.new_start_time} - {request.new_end_time}</span>
                        </div>
                    </div>

                    {request.reason && (
                      <p className="text-sm bg-muted p-2 rounded mt-2 border-l-2 border-primary/20 pl-3">
                        {request.reason}
                      </p>
                    )}
                  </div>

                  {request.status === 'pending' && (
                    <div className="flex sm:flex-col gap-2 w-full sm:w-auto min-w-[100px]">
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 flex-1"
                        onClick={() => handleRequest.mutate({ request, status: 'approved' })}
                        disabled={handleRequest.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleRequest.mutate({ request, status: 'rejected' })}
                        disabled={handleRequest.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
