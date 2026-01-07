import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';

export const ManagerScheduleRequests = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Added Real-time subscription so managers see requests instantly
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

  const updateRequest = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
      const { error } = await supabase
        .from('schedule_requests')
        .update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['managerScheduleRequests'] });
      toast.success(`Request ${status}`);
    },
    onError: () => {
      toast.error('Failed to update request');
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
            <Card key={request.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{request.subject}</h3>
                      <Badge variant="outline">{request.batch}</Badge>
                      {getStatusBadge(request.status || 'pending')}
                    </div>
                    <p className="text-sm text-muted-foreground mb-1">
                      By: {request.teachers?.name || 'Unknown Teacher'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Requested: {format(new Date(request.new_date), 'MMM d, yyyy')} • {request.new_start_time} - {request.new_end_time}
                    </p>
                    {request.reason && (
                      <p className="text-sm mt-2 bg-muted p-2 rounded">{request.reason}</p>
                    )}
                  </div>
                  {request.status === 'pending' && (
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 hover:text-green-700"
                        onClick={() => updateRequest.mutate({ id: request.id, status: 'approved' })}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => updateRequest.mutate({ id: request.id, status: 'rejected' })}
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
