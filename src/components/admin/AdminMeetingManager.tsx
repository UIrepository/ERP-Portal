
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link, Save, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const AdminMeetingManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [newLink, setNewLink] = useState('');
  
  const { data: schedules } = useQuery({
    queryKey: ['admin-meeting-schedules'],
    queryFn: async () => {
      const { data } = await supabase
        .from('schedules')
        .select('*')
        .order('batch', { ascending: true });
      return data || [];
    },
  });

  const updateLinkMutation = useMutation({
    mutationFn: async ({ id, link }: { id: string; link: string }) => {
      const { error } = await supabase
        .from('schedules')
        .update({ link })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-meeting-schedules'] });
      toast({ title: "Success", description: "Meeting link updated successfully" });
      setEditingSchedule(null);
      setNewLink('');
    },
    onError: (error) => {
      toast({ title: "Error", description: "Failed to update meeting link", variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!editingSchedule || !newLink) return;
    
    updateLinkMutation.mutate({
      id: editingSchedule.id,
      link: newLink,
    });
  };

  const startEditing = (schedule: any) => {
    setEditingSchedule(schedule);
    setNewLink(schedule.link || '');
  };

  const getDayName = (dayNumber: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNumber] || 'Unknown';
  };

  // Group schedules by batch and subject
  const groupedSchedules = schedules?.reduce((acc, schedule) => {
    const key = `${schedule.batch}-${schedule.subject}`;
    if (!acc[key]) {
      acc[key] = {
        batch: schedule.batch,
        subject: schedule.subject,
        schedules: [],
      };
    }
    acc[key].schedules.push(schedule);
    return acc;
  }, {} as Record<string, any>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center">
          <Link className="mr-2 h-6 w-6" />
          Meeting Link Manager
        </h2>
        <p className="text-sm text-muted-foreground">
          Set universal meeting links for each batch + subject combination
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Batch + Subject Groups */}
        <Card>
          <CardHeader>
            <CardTitle>Batch & Subject Combinations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.values(groupedSchedules || {}).map((group: any) => (
                <div key={`${group.batch}-${group.subject}`} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium">{group.subject}</h4>
                      <Badge variant="outline">{group.batch}</Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEditing(group.schedules[0])}
                    >
                      <Link className="h-4 w-4 mr-1" />
                      Set Link
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium">Current Link: </span>
                      {group.schedules[0].link ? (
                        <a 
                          href={group.schedules[0].link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {group.schedules[0].link.length > 50 
                            ? `${group.schedules[0].link.substring(0, 50)}...` 
                            : group.schedules[0].link}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">No link set</span>
                      )}
                    </div>
                    
                    <div className="text-sm">
                      <span className="font-medium">Schedule: </span>
                      {group.schedules.map((schedule: any, index: number) => (
                        <span key={schedule.id} className="text-muted-foreground">
                          {getDayName(schedule.day_of_week)} {schedule.start_time}-{schedule.end_time}
                          {index < group.schedules.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Edit Form */}
        {editingSchedule && (
          <Card>
            <CardHeader>
              <CardTitle>Set Meeting Link</CardTitle>
              <p className="text-sm text-muted-foreground">
                {editingSchedule.subject} - {editingSchedule.batch}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Universal Meeting Link
                </label>
                <Input
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This link will be used for all classes of this subject in this batch
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={handleSave} className="flex-1">
                  <Save className="mr-2 h-4 w-4" />
                  Save Link
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingSchedule(null);
                    setNewLink('');
                  }}
                >
                  Cancel
                </Button>
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Usage Instructions</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• This link will be shown to students during class times</li>
                  <li>• Teachers can access this link from their dashboard</li>
                  <li>• Link applies to all scheduled classes for this combination</li>
                  <li>• Use permanent meeting room links for consistency</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
