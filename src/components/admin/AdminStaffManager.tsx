import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, User, Shield, Users, Loader2, Mail, Edit, Clock, CheckCircle } from 'lucide-react';

export const AdminStaffManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeStaffTab, setActiveStaffTab] = useState('admins');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    assigned_batches: [] as string[],
    assigned_subjects: [] as string[]
  });

  // Fetch available options for batches and subjects
  const { data: availableOptions } = useQuery({
    queryKey: ['availableOptions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('available_options').select('*');
      if (error) throw error;
      return data || [];
    }
  });

  const batches = availableOptions?.filter(o => o.type === 'batch').map(o => o.name) || [];
  const subjects = availableOptions?.filter(o => o.type === 'subject').map(o => o.name) || [];

  // Fetch admins
  const { data: admins, isLoading: loadingAdmins } = useQuery({
    queryKey: ['allAdmins'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admins').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch managers
  const { data: managers, isLoading: loadingManagers } = useQuery({
    queryKey: ['allManagers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('managers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch teachers
  const { data: teachers, isLoading: loadingTeachers } = useQuery({
    queryKey: ['allTeachers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('teachers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  });

  // Add staff mutation
  const addStaff = useMutation({
    mutationFn: async () => {
      // First, find or create the user by email
      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', formData.email)
        .single();

      const userId = profileData?.user_id || null;

      const table = activeStaffTab === 'admins' ? 'admins' : activeStaffTab === 'managers' ? 'managers' : 'teachers';
      
      const insertData: any = {
        name: formData.name,
        email: formData.email,
        user_id: userId
      };

      if (activeStaffTab === 'managers') {
        insertData.assigned_batches = formData.assigned_batches;
      }
      if (activeStaffTab === 'teachers') {
        insertData.assigned_batches = formData.assigned_batches;
        insertData.assigned_subjects = formData.assigned_subjects;
      }

      const { error } = await supabase.from(table).insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allAdmins'] });
      queryClient.invalidateQueries({ queryKey: ['allManagers'] });
      queryClient.invalidateQueries({ queryKey: ['allTeachers'] });
      toast.success(`${activeStaffTab.slice(0, -1)} added successfully`);
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add staff');
    }
  });

  // Update staff mutation
  const updateStaff = useMutation({
    mutationFn: async () => {
      if (!editingStaff) return;
      const table = activeStaffTab === 'admins' ? 'admins' : activeStaffTab === 'managers' ? 'managers' : 'teachers';
      
      const updateData: any = {
        name: formData.name,
        email: formData.email
      };

      if (activeStaffTab === 'managers') {
        updateData.assigned_batches = formData.assigned_batches;
      }
      if (activeStaffTab === 'teachers') {
        updateData.assigned_batches = formData.assigned_batches;
        updateData.assigned_subjects = formData.assigned_subjects;
      }

      const { error } = await supabase.from(table).update(updateData).eq('id', editingStaff.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allAdmins'] });
      queryClient.invalidateQueries({ queryKey: ['allManagers'] });
      queryClient.invalidateQueries({ queryKey: ['allTeachers'] });
      toast.success('Staff updated successfully');
      setEditingStaff(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update staff');
    }
  });

  // Delete staff mutation
  const deleteStaff = useMutation({
    mutationFn: async (id: string) => {
      const table = activeStaffTab === 'admins' ? 'admins' : activeStaffTab === 'managers' ? 'managers' : 'teachers';
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allAdmins'] });
      queryClient.invalidateQueries({ queryKey: ['allManagers'] });
      queryClient.invalidateQueries({ queryKey: ['allTeachers'] });
      toast.success('Staff removed successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove staff');
    }
  });

  const resetForm = () => {
    setFormData({ name: '', email: '', assigned_batches: [], assigned_subjects: [] });
  };

  const openEditDialog = (staff: any) => {
    setEditingStaff(staff);
    setFormData({
      name: staff.name,
      email: staff.email,
      assigned_batches: staff.assigned_batches || [],
      assigned_subjects: staff.assigned_subjects || []
    });
  };

  const toggleBatch = (batch: string) => {
    setFormData(prev => ({
      ...prev,
      assigned_batches: prev.assigned_batches.includes(batch)
        ? prev.assigned_batches.filter(b => b !== batch)
        : [...prev.assigned_batches, batch]
    }));
  };

  const toggleSubject = (subject: string) => {
    setFormData(prev => ({
      ...prev,
      assigned_subjects: prev.assigned_subjects.includes(subject)
        ? prev.assigned_subjects.filter(s => s !== subject)
        : [...prev.assigned_subjects, subject]
    }));
  };

  const renderStaffList = (staffList: any[], loading: boolean, type: string) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (!staffList?.length) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No {type} found.</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {staffList.map((staff) => {
          const hasSignedUp = !!staff.user_id;
          return (
            <Card key={staff.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-full">
                      {type === 'admins' ? <Shield className="h-5 w-5 text-primary" /> : 
                       type === 'managers' ? <Users className="h-5 w-5 text-primary" /> :
                       <User className="h-5 w-5 text-primary" />}
                    </div>
                    <div>
                      <h3 className="font-semibold">{staff.name}</h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <Mail className="h-3 w-3" />
                        {staff.email}
                      </div>
                      {/* Status Indicator */}
                      <div className="mt-2">
                        {hasSignedUp ? (
                          <Badge variant="default" className="bg-green-500/20 text-green-700 border-green-500/30 hover:bg-green-500/30">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 border-amber-500/30 hover:bg-amber-500/30">
                            <Clock className="h-3 w-3 mr-1" />
                            Pending Signup
                          </Badge>
                        )}
                      </div>
                      {staff.assigned_batches?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {staff.assigned_batches.map((batch: string) => (
                            <Badge key={batch} variant="outline" className="text-xs">{batch}</Badge>
                          ))}
                        </div>
                      )}
                      {staff.assigned_subjects?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {staff.assigned_subjects.map((subject: string) => (
                            <Badge key={subject} variant="secondary" className="text-xs">{subject}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEditDialog(staff)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => deleteStaff.mutate(staff.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderForm = () => (
    <div className="space-y-4">
      <div>
        <Label>Name</Label>
        <Input value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} placeholder="Enter name" />
      </div>
      <div>
        <Label>Email</Label>
        <Input type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} placeholder="Enter email" />
      </div>
      {(activeStaffTab === 'managers' || activeStaffTab === 'teachers') && (
        <div>
          <Label>Assigned Batches</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {batches.map((batch) => (
              <Badge
                key={batch}
                variant={formData.assigned_batches.includes(batch) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => toggleBatch(batch)}
              >
                {batch}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {activeStaffTab === 'teachers' && (
        <div>
          <Label>Assigned Subjects</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {subjects.map((subject) => (
              <Badge
                key={subject}
                variant={formData.assigned_subjects.includes(subject) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => toggleSubject(subject)}
              >
                {subject}
              </Badge>
            ))}
          </div>
        </div>
      )}
      <Button 
        onClick={() => editingStaff ? updateStaff.mutate() : addStaff.mutate()} 
        disabled={addStaff.isPending || updateStaff.isPending} 
        className="w-full"
      >
        {(addStaff.isPending || updateStaff.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {editingStaff ? 'Update' : 'Add'} {activeStaffTab.slice(0, -1)}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Staff Management</h2>
          <p className="text-muted-foreground">Manage admins, managers, and teachers</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Staff</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New {activeStaffTab.slice(0, -1)}</DialogTitle>
            </DialogHeader>
            {renderForm()}
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingStaff} onOpenChange={(open) => { if (!open) { setEditingStaff(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {activeStaffTab.slice(0, -1)}</DialogTitle>
          </DialogHeader>
          {renderForm()}
        </DialogContent>
      </Dialog>

      <Tabs value={activeStaffTab} onValueChange={setActiveStaffTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="admins" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />Admins ({admins?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="managers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />Managers ({managers?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="teachers" className="flex items-center gap-2">
            <User className="h-4 w-4" />Teachers ({teachers?.length || 0})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="admins" className="mt-6">
          {renderStaffList(admins || [], loadingAdmins, 'admins')}
        </TabsContent>
        <TabsContent value="managers" className="mt-6">
          {renderStaffList(managers || [], loadingManagers, 'managers')}
        </TabsContent>
        <TabsContent value="teachers" className="mt-6">
          {renderStaffList(teachers || [], loadingTeachers, 'teachers')}
        </TabsContent>
      </Tabs>
    </div>
  );
};
