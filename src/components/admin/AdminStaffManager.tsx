import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Define a unified type for all staff members
type StaffMember = {
  id: string; // The ID from the specific table (teachers/admins/managers)
  user_id: string | null; // The auth user_id
  name: string;
  email: string;
  role: 'teacher' | 'admin' | 'manager';
  created_at?: string | null;
};

export default function AdminStaffManager() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchStaff = async () => {
    try {
      setLoading(true);

      // 1. Fetch from the specific 'teachers' table
      const { data: teachers, error: teacherError } = await supabase
        .from('teachers')
        .select('*');
      if (teacherError) throw teacherError;

      // 2. Fetch from the specific 'managers' table
      const { data: managers, error: managerError } = await supabase
        .from('managers')
        .select('*');
      if (managerError) throw managerError;

      // 3. Fetch from the specific 'admins' table
      const { data: admins, error: adminError } = await supabase
        .from('admins')
        .select('*');
      if (adminError) throw adminError;

      // 4. Format and combine the data
      const formattedTeachers = (teachers || []).map(t => ({ 
        id: t.id,
        user_id: t.user_id,
        name: t.name,
        email: t.email,
        created_at: t.created_at,
        role: 'teacher' as const 
      }));

      const formattedManagers = (managers || []).map(m => ({ 
        id: m.id,
        user_id: m.user_id,
        name: m.name,
        email: m.email,
        created_at: m.created_at,
        role: 'manager' as const 
      }));

      const formattedAdmins = (admins || []).map(a => ({ 
        id: a.id,
        user_id: a.user_id,
        name: a.name,
        email: a.email,
        created_at: a.created_at,
        role: 'admin' as const 
      }));

      // Combine all and sort by creation date (newest first)
      const allStaff = [...formattedAdmins, ...formattedManagers, ...formattedTeachers].sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });

      setStaff(allStaff);

    } catch (error: any) {
      console.error('Error fetching staff:', error);
      toast({
        title: "Error",
        description: "Failed to load staff members: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  return (
    <Card className="w-full shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Staff Management</CardTitle>
          <CardDescription>
            Overview of all Teachers, Managers, and Admins
          </CardDescription>
        </div>
        <Button variant="outline" size="icon" onClick={fetchStaff} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : staff.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
            No staff members found in the system.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member) => (
                  <TableRow key={`${member.role}-${member.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{member.name}</span>
                        {/* Optional: Show ID for debugging */}
                        {/* <span className="text-xs text-muted-foreground">{member.id}</span> */}
                      </div>
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary"
                        className={`
                          ${member.role === 'admin' ? 'bg-red-100 text-red-700 hover:bg-red-100' : ''}
                          ${member.role === 'manager' ? 'bg-purple-100 text-purple-700 hover:bg-purple-100' : ''}
                          ${member.role === 'teacher' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' : ''}
                        `}
                      >
                        {member.role.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {member.created_at 
                        ? new Date(member.created_at).toLocaleDateString() 
                        : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
