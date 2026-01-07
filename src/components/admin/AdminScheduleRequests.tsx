import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock, Calendar, User, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export const AdminScheduleRequests = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Real-time listener
  useEffect(() => {
    const channel = supabase
      .channel('admin-schedule-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schedule_requests' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['adminScheduleRequests'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['adminScheduleRequests'],
    queryFn: async () => {
      // Admins see ALL requests
      const { data, error } = await supabase
        .from('schedule_requests')
        .select(`
          *,
          teachers:requested_by (name, email)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const handleRequest = useMutation({
    mutationFn: async ({ request, status }: { request: any; status: 'approved' | 'rejected' }) => {
      
      // LOGIC: If approving, update the actual schedule table
      if (status === 'approved') {
        if (!request.schedule_id) {
           console.warn("No schedule_id found on this request.");
           // We continue but cannot update the schedule table
        } else {
            const { error: scheduleError } = await supabase
              .from('schedules')
              .update({
                date: request.new_date,
                start_time: request.new_start_time,
                end_time: request.new_end_time,
                day_of_week: new Date(request.new_date).getDay()
              })
              .eq('id', request.schedule_id);
              
            if (scheduleError) {
                console.error("Schedule Update Failed", scheduleError);
                throw new Error('Failed to update the class schedule. Check permissions.');
            }
        }
      }

      // Update the request status
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
      queryClient.invalidateQueries({ queryKey: ['adminScheduleRequests'] });
      // Force refresh of schedules so the new time shows up immediately
      queryClient.invalidateQueries({ queryKey: ['admin-all-schedules'] });
      toast.success(`Request ${status} successfully`);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update request');
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Schedule Requests</h2>
          <p className="text-muted-foreground">Manage schedule change requests from all teachers.</p>
        </div>
        <div className="bg-muted px-4 py-2 rounded-md">
          <span className="font-semibold">{requests?.filter((r: any) => r.status === 'pending').length || 0}</span> Pending Requests
        </div>
      </div>

      {!requests?.length ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Requests Found</h3>
            <p className="text-muted-foreground">There are no schedule requests to review at this time.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request: any) => (
            <Card key={request.id} className={request.status === 'pending' ? 'border-l-4 border-l-yellow-400' : ''}>
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-6 justify-between">
                  <div className="space-y-4 flex-1">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-base px-3 py-1 bg-primary/5">
                        {request.subject}
                      </Badge>
                      <Badge variant="secondary" className="text-base px-3 py-1">
                        {request.batch}
                      </Badge>
                      {getStatusBadge(request.status || 'pending')}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                       <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>Requested by: <span className="font-medium text-foreground">{request.teachers?.name}</span></span>
                       </div>
                       <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>New Schedule: <span className="font-medium text-foreground">{format(new Date(request.new_date), 'MMM d, yyyy')} • {request.new_start_time} - {request.new_end_time}</span></span>
                       </div>
                    </div>

                    {request.reason && (
                      <div className="bg-muted/50 p-3 rounded-md text-sm">
                        <span className="font-semibold block mb-1">Reason:</span>
                        {request.reason}
                      </div>
                    )}

                    {/* Safety Alert for Old Requests */}
                    {request.status === 'pending' && !request.schedule_id && (
                        <div className="flex gap-2 items-start text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 mt-2">
                           <AlertTriangle className="h-4 w-4 shrink-0" />
                           <p><strong>Warning:</strong> This is a legacy request (missing ID). Approving it will update the status but <strong>will NOT</strong> auto-update the schedule. You must change the schedule manually.</p>
                        </div>
                    )}
                  </div>

                  {request.status === 'pending' && (
                    <div className="flex md:flex-col gap-2 justify-center min-w-[120px]">
                      <Button
                        className="bg-green-600 hover:bg-green-700 w-full"
                        onClick={() => handleRequest.mutate({ request, status: 'approved' })}
                        disabled={handleRequest.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => handleRequest.mutate({ request, status: 'rejected' })}
                        disabled={handleRequest.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
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
