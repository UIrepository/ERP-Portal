import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Trash2, Plus, Settings, Users } from 'lucide-react';
import { format } from 'date-fns';

export const AdminMaintenanceManager = () => {
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState('');

  // Fetch maintenance settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['admin-maintenance-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_settings')
        .select('*')
        .limit(1)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch verified users
  const { data: verifiedUsers, isLoading: usersLoading } = useQuery({
    queryKey: ['verified-maintenance-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('verified_maintenance_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Update maintenance mode
  const updateSettingsMutation = useMutation({
    mutationFn: async ({ isMaintenanceMode, message }: { isMaintenanceMode: boolean; message?: string }) => {
      const updateData: Record<string, unknown> = {
        is_maintenance_mode: isMaintenanceMode,
        updated_at: new Date().toISOString(),
      };
      if (message !== undefined) {
        updateData.maintenance_message = message;
      }

      const { error } = await supabase
        .from('maintenance_settings')
        .update(updateData)
        .eq('id', settings?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-maintenance-settings'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-settings'] });
      toast.success('Maintenance settings updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update settings: ' + error.message);
    },
  });

  // Add verified user
  const addUserMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase
        .from('verified_maintenance_users')
        .insert({ email: email.toLowerCase().trim() });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verified-maintenance-users'] });
      setNewEmail('');
      toast.success('User added to verified list');
    },
    onError: (error: Error) => {
      toast.error('Failed to add user: ' + error.message);
    },
  });

  // Remove verified user
  const removeUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('verified_maintenance_users')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verified-maintenance-users'] });
      toast.success('User removed from verified list');
    },
    onError: (error: Error) => {
      toast.error('Failed to remove user: ' + error.message);
    },
  });

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    addUserMutation.mutate(newEmail);
  };

  if (settingsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">Maintenance Mode</h1>
      </div>

      {/* Maintenance Toggle Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Maintenance Status</CardTitle>
          <CardDescription>
            Enable or disable maintenance mode for the website
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="maintenance-toggle">Maintenance Mode</Label>
            <Select
              value={settings?.is_maintenance_mode ? 'enabled' : 'disabled'}
              onValueChange={(value) =>
                updateSettingsMutation.mutate({ isMaintenanceMode: value === 'enabled' })
              }
            >
              <SelectTrigger id="maintenance-toggle" className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="disabled">Disabled - Website is live</SelectItem>
                <SelectItem value="enabled">Enabled - Website under maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maintenance-message">Maintenance Message</Label>
            <Textarea
              id="maintenance-message"
              placeholder="Enter the message to display during maintenance..."
              defaultValue={settings?.maintenance_message || ''}
              className="min-h-24"
              onBlur={(e) =>
                updateSettingsMutation.mutate({
                  isMaintenanceMode: settings?.is_maintenance_mode ?? false,
                  message: e.target.value,
                })
              }
            />
          </div>

          <div className={`p-3 rounded-md ${settings?.is_maintenance_mode ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-green-500/10 border border-green-500/30'}`}>
            <p className={`text-sm font-medium ${settings?.is_maintenance_mode ? 'text-amber-600' : 'text-green-600'}`}>
              {settings?.is_maintenance_mode
                ? 'Maintenance mode is ON. Only verified users can access the website.'
                : 'Maintenance mode is OFF. Website is accessible to everyone.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Verified Users Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Verified Users
              </CardTitle>
              <CardDescription>
                Users who can access the website during maintenance
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAddUser} className="flex gap-2">
            <Input
              type="email"
              placeholder="Enter email address..."
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={addUserMutation.isPending || !newEmail.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </form>

          {usersLoading ? (
            <div className="text-center py-4 text-muted-foreground text-sm">Loading users...</div>
          ) : verifiedUsers && verifiedUsers.length > 0 ? (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Added On</TableHead>
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {verifiedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(user.created_at), 'dd MMM yyyy, HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeUserMutation.mutate(user.id)}
                          disabled={removeUserMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm border rounded-md bg-muted/30">
              No verified users added yet. Add email addresses to allow access during maintenance.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
