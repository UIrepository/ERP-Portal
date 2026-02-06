import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, User, Shield, Briefcase, Headphones } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { StudentDirectMessage } from './StudentDirectMessage';
import { useState } from 'react';

interface StudentConnectProps {
  onOpenSupportDrawer?: () => void;
}

export const StudentConnect = ({ onOpenSupportDrawer }: StudentConnectProps) => {
  const { profile } = useAuth();
  
  // 1. Fetch Teachers assigned to student's batch(es)
  const { data: teachers, isLoading: loadingTeachers } = useQuery({
    queryKey: ['my-teachers', profile?.user_id],
    queryFn: async () => {
      // First get student's enrolled batches
      const { data: enrollments } = await supabase
        .from('user_enrollments')
        .select('batch_name')
        .eq('user_id', profile?.user_id);
      
      const myBatches = enrollments?.map(e => e.batch_name) || [];

      if (myBatches.length === 0) return [];

      // Fetch teachers who have these batches in their assigned_batches array
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .overlaps('assigned_batches', myBatches);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.user_id
  });

  // 2. Fetch Managers assigned to student's batch(es)
  const { data: managers, isLoading: loadingManagers } = useQuery({
    queryKey: ['my-managers', profile?.user_id],
    queryFn: async () => {
      const { data: enrollments } = await supabase
        .from('user_enrollments')
        .select('batch_name')
        .eq('user_id', profile?.user_id);
      
      const myBatches = enrollments?.map(e => e.batch_name) || [];
      if (myBatches.length === 0) return [];

      const { data, error } = await supabase
        .from('managers')
        .select('*')
        .overlaps('assigned_batches', myBatches);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.user_id
  });

  // 3. Fetch Admins (Always visible)
  const { data: admins } = useQuery({
    queryKey: ['all-admins'],
    queryFn: async () => {
      const { data } = await supabase.from('admins').select('*');
      return data || [];
    }
  });

  const [selectedContact, setSelectedContact] = useState<{id: string, name: string, role: string} | null>(null);

  const renderCard = (person: any, role: string, icon: any) => (
    <Card key={person.id} className="hover:shadow-md transition-all">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12 border-2 border-gray-100">
            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${person.name}`} />
            <AvatarFallback>{person.name.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-gray-800">{person.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs capitalize">
                {role}
              </Badge>
              {role === 'Teacher' && person.assigned_subjects && (
                <span className="text-xs text-muted-foreground">
                  • {person.assigned_subjects.join(', ')}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button 
              size="sm" 
              variant="default" 
              className="gap-2"
              onClick={() => setSelectedContact({ id: person.user_id, name: person.name, role })}
            >
              <MessageCircle className="h-4 w-4" />
              Chat
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Chat with {person.name}</DialogTitle>
            </DialogHeader>
            {/* We render the chat component inside the dialog */}
            {selectedContact && (
              <StudentDirectMessage receiverId={person.user_id} receiverName={person.name} />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8 p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Your Mentors</h1>
          <p className="text-muted-foreground mt-2">Connect with your teachers, batch managers, and admins.</p>
        </div>
        {onOpenSupportDrawer && (
          <Button onClick={onOpenSupportDrawer} className="gap-2">
            <Headphones className="h-4 w-4" />
            Get Support
          </Button>
        )}
      </div>

      {/* Admins */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5 text-red-500" /> Admins
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {admins?.map(admin => renderCard(admin, 'Admin', Shield))}
        </div>
      </div>

      {/* Managers */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-blue-500" /> Managers
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {managers?.length ? managers.map(mgr => renderCard(mgr, 'Manager', Briefcase)) : <p className="text-muted-foreground">No managers assigned.</p>}
        </div>
      </div>

      {/* Teachers */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <User className="h-5 w-5 text-green-500" /> Teachers
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {teachers?.length ? teachers.map(teacher => renderCard(teacher, 'Teacher', User)) : <p className="text-muted-foreground">No teachers assigned.</p>}
        </div>
      </div>
    </div>
  );
};
