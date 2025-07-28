
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Plus, Clock, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';

export const TeacherExtraClasses = () => {
  const { profile } = useAuth();
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [newClass, setNewClass] = useState({
    subject: '',
    date: '',
    start_time: '',
    end_time: '',
    reason: '',
    link: ''
  });

  const queryClient = useQueryClient();

  const { data: extraClasses } = useQuery({
    queryKey: ['teacher-extra-classes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('extra_classes')
        .select('*')
        .eq('batch', profile?.batch)
        .in('subject', profile?.subjects || [])
        .order('date', { ascending: true });
      return data || [];
    },
    enabled: !!profile?.batch && !!profile?.subjects
  });

  const addExtraClassMutation = useMutation({
    mutationFn: async (classData: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Check for conflicts
      const { data: conflictCheck } = await supabase
        .from('extra_classes')
        .select('*')
        .eq('date', classData.date)
        .eq('batch', profile?.batch)
        .or(`start_time.lte.${classData.end_time},end_time.gte.${classData.start_time}`);
      
      if (conflictCheck && conflictCheck.length > 0) {
        throw new Error('Time conflict detected with existing class');
      }

      const { error } = await supabase
        .from('extra_classes')
        .insert([{
          ...classData,
          batch: profile?.batch,
          created_by: user?.id
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-extra-classes'] });
      setIsAddClassOpen(false);
      setNewClass({
        subject: '',
        date: '',
        start_time: '',
        end_time: '',
        reason: '',
        link: ''
      });
      toast({
        title: 'Success',
        description: 'Extra class scheduled successfully',
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

  const handleAddClass = () => {
    if (!newClass.subject || !newClass.date || !newClass.start_time || !newClass.end_time) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    addExtraClassMutation.mutate(newClass);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Extra Classes</h2>
        <Dialog open={isAddClassOpen} onOpenChange={setIsAddClassOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Schedule Extra Class
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Schedule Extra Class</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Select value={newClass.subject} onValueChange={(value) => setNewClass({ ...newClass, subject: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {profile?.subjects?.map((subject) => (
                      <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={newClass.date}
                  onChange={(e) => setNewClass({ ...newClass, date: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time">Start Time</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={newClass.start_time}
                    onChange={(e) => setNewClass({ ...newClass, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="end_time">End Time</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={newClass.end_time}
                    onChange={(e) => setNewClass({ ...newClass, end_time: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="link">Class Link</Label>
                <Input
                  id="link"
                  value={newClass.link}
                  onChange={(e) => setNewClass({ ...newClass, link: e.target.value })}
                  placeholder="Enter class link (optional)"
                />
              </div>
              <div>
                <Label htmlFor="reason">Reason</Label>
                <Input
                  id="reason"
                  value={newClass.reason}
                  onChange={(e) => setNewClass({ ...newClass, reason: e.target.value })}
                  placeholder="Enter reason for extra class (optional)"
                />
              </div>
              <Button onClick={handleAddClass} className="w-full">
                Schedule Class
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {extraClasses && extraClasses.length > 0 ? (
          extraClasses.map((extraClass) => (
            <Card key={extraClass.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{extraClass.subject}</h3>
                    <div className="flex items-center text-sm text-muted-foreground mt-1">
                      <Calendar className="h-4 w-4 mr-1" />
                      {format(new Date(extraClass.date), 'PPP')}
                    </div>
                    <div className="flex items-center text-sm text-muted-foreground mt-1">
                      <Clock className="h-4 w-4 mr-1" />
                      {extraClass.start_time} - {extraClass.end_time}
                    </div>
                    {extraClass.reason && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Reason: {extraClass.reason}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="outline">{extraClass.batch}</Badge>
                    {extraClass.link && (
                      <Button size="sm" asChild>
                        <a href={extraClass.link} target="_blank" rel="noopener noreferrer">
                          Join Class
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No extra classes scheduled</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
