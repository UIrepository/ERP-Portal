
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Plus, Send, Eye, EyeOff } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format } from 'date-fns';

export const NotificationCenter = () => {
  const [isAddNotificationOpen, setIsAddNotificationOpen] = useState(false);
  const [newNotification, setNewNotification] = useState({
    title: '',
    message: '',
    target_role: '',
    target_batch: '',
    target_subject: '',
    is_active: true
  });

  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const addNotificationMutation = useMutation({
    mutationFn: async (notificationData: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('notifications')
        .insert([{
          ...notificationData,
          created_by: user?.id,
          target_role: notificationData.target_role || null,
          target_batch: notificationData.target_batch || null,
          target_subject: notificationData.target_subject || null
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      setIsAddNotificationOpen(false);
      setNewNotification({
        title: '',
        message: '',
        target_role: '',
        target_batch: '',
        target_subject: '',
        is_active: true
      });
      toast({
        title: 'Success',
        description: 'Notification sent successfully',
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

  const toggleNotificationMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_active })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      toast({
        title: 'Success',
        description: 'Notification status updated',
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

  const handleAddNotification = () => {
    addNotificationMutation.mutate(newNotification);
  };

  const toggleNotification = (id: string, currentStatus: boolean) => {
    toggleNotificationMutation.mutate({ id, is_active: !currentStatus });
  };

  const roleOptions = [
    { value: '', label: 'All Roles' },
    { value: 'student', label: 'Students' },
    { value: 'teacher', label: 'Teachers' }
  ];

  const batchOptions = [
    { value: '', label: 'All Batches' },
    { value: '2024-A', label: '2024-A' },
    { value: '2024-B', label: '2024-B' },
    { value: '2025-A', label: '2025-A' },
    { value: '2025-B', label: '2025-B' }
  ];

  const subjectOptions = [
    { value: '', label: 'All Subjects' },
    { value: 'Mathematics', label: 'Mathematics' },
    { value: 'Physics', label: 'Physics' },
    { value: 'Chemistry', label: 'Chemistry' },
    { value: 'Biology', label: 'Biology' },
    { value: 'English', label: 'English' },
    { value: 'History', label: 'History' },
    { value: 'Computer Science', label: 'Computer Science' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Notification Center</h2>
        <Dialog open={isAddNotificationOpen} onOpenChange={setIsAddNotificationOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Notification
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Notification</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={newNotification.title}
                  onChange={(e) => setNewNotification({ ...newNotification, title: e.target.value })}
                  placeholder="Enter notification title"
                />
              </div>
              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  value={newNotification.message}
                  onChange={(e) => setNewNotification({ ...newNotification, message: e.target.value })}
                  placeholder="Enter notification message"
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="target_role">Target Role</Label>
                  <Select value={newNotification.target_role} onValueChange={(value) => setNewNotification({ ...newNotification, target_role: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((role) => (
                        <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="target_batch">Target Batch</Label>
                  <Select value={newNotification.target_batch} onValueChange={(value) => setNewNotification({ ...newNotification, target_batch: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {batchOptions.map((batch) => (
                        <SelectItem key={batch.value} value={batch.value}>{batch.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="target_subject">Target Subject</Label>
                  <Select value={newNotification.target_subject} onValueChange={(value) => setNewNotification({ ...newNotification, target_subject: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjectOptions.map((subject) => (
                        <SelectItem key={subject.value} value={subject.value}>{subject.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={newNotification.is_active}
                  onCheckedChange={(checked) => setNewNotification({ ...newNotification, is_active: checked })}
                />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <Button onClick={handleAddNotification} className="w-full">
                <Send className="h-4 w-4 mr-2" />
                Send Notification
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {notifications.map((notification) => (
          <Card key={notification.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{notification.title}</h3>
                    <Badge variant={notification.is_active ? 'default' : 'secondary'}>
                      {notification.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{notification.message}</p>
                  <div className="flex gap-2">
                    {notification.target_role && (
                      <Badge variant="outline">Role: {notification.target_role}</Badge>
                    )}
                    {notification.target_batch && (
                      <Badge variant="outline">Batch: {notification.target_batch}</Badge>
                    )}
                    {notification.target_subject && (
                      <Badge variant="outline">Subject: {notification.target_subject}</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(notification.created_at), 'PPp')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleNotification(notification.id, notification.is_active)}
                  >
                    {notification.is_active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
