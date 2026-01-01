import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2,
  Plus,
  Trash2,
  Shield,
  UserCog,
  GraduationCap,
  Check,
  ChevronsUpDown,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// --- Helper Component: MultiSelect ---
interface MultiSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

const MultiSelect = ({ options, selected, onChange, placeholder }: MultiSelectProps) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleRemove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter((item) => item !== value));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-auto min-h-[40px] px-3 py-2"
        >
          <div className="flex flex-wrap gap-1 text-left">
            {selected.length === 0 && (
              <span className="text-muted-foreground font-normal">{placeholder || "Select..."}</span>
            )}
            {selected.map((item) => (
              <Badge key={item} variant="secondary" className="mr-1 mb-1">
                {item}
                <span
                  className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => handleRemove(item, e)}
                >
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </span>
              </Badge>
            ))}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0">
        <Command>
          <CommandInput placeholder={`Search ${placeholder?.toLowerCase()}...`} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  onSelect={() => handleSelect(option)}
                  className="cursor-pointer"
                >
                  <div
                    className={`mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary ${
                      selected.includes(option)
                        ? "bg-primary text-primary-foreground"
                        : "opacity-50 [&_svg]:invisible"
                    }`}
                  >
                    <Check className="h-3 w-3" />
                  </div>
                  <span>{option}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export const AdminStaffManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Form State
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'teacher' | 'manager'>('teacher');
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Fetch Staff List
  const { data: staff, isLoading } = useQuery({
    queryKey: ['admin-staff'],
    queryFn: async () => {
      // Fetch teachers
      const { data: teachers, error: tError } = await supabase
        .from('teachers')
        .select('*');
      if (tError) throw tError;

      // Fetch managers (using profiles table for now as a fallback if no managers table exists yet, 
      // or assume you might create a managers table later. For now, we look at profiles with role 'manager')
      const { data: managers, error: mError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'manager');
      if (mError) throw mError;

      // Normalize data structure
      const formattedTeachers = teachers.map((t) => ({
        id: t.id,
        user_id: t.user_id,
        name: t.name,
        email: t.email,
        role: 'teacher' as const,
        batches: t.assigned_batches || [],
        subjects: t.assigned_subjects || [],
      }));

      const formattedManagers = managers.map((m) => ({
        id: m.id,
        user_id: m.user_id, // Important for linking
        name: m.name || 'Unknown',
        email: m.email || '',
        role: 'manager' as const,
        batches: [], // Managers might not have these columns in profiles yet
        subjects: [],
      }));

      return [...formattedTeachers, ...formattedManagers];
    },
  });

  // 2. Fetch Unique Batches & Subjects for Dropdowns
  const { data: uniqueData } = useQuery({
    queryKey: ['unique-batches-subjects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_enrollments')
        .select('batch_name, subject_name');
      
      const batches = Array.from(new Set(data?.map(d => d.batch_name).filter(Boolean))).sort() as string[];
      const subjects = Array.from(new Set(data?.map(d => d.subject_name).filter(Boolean))).sort() as string[];
      
      return { batches, subjects };
    }
  });

  const handleCreateStaff = async () => {
    if (!newStaffName || !newStaffEmail) {
      toast({ title: "Missing Fields", description: "Name and Email are required.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create Auth User (Backend Function usually handles this, but here we might just insert into tables)
      // NOTE: In a real app, you usually invite a user via supabase.auth.admin.inviteUserByEmail
      // For this demo, we will assume we are just creating the PROFILE record.
      // Ideally, the user should sign up themselves, or you use an Edge Function to create them.
      
      // Let's look for an existing user or just insert into the specific tables.
      // Since we can't create Auth users from client side without Service Role, 
      // we will assume we are just adding metadata for a user who WILL sign up, 
      // OR we are updating an existing user.
      
      // However, to make this functional for YOU right now:
      // We will insert into the 'teachers' table directly. 
      // The trigger will likely handle the profile sync if you have one.

      if (newStaffRole === 'teacher') {
        const { error } = await supabase.from('teachers').insert({
          name: newStaffName,
          email: newStaffEmail,
          assigned_batches: selectedBatches,
          assigned_subjects: selectedSubjects,
          // We don't have a user_id yet if they haven't signed up. 
          // This might be a "Pre-allocation".
        });
        if (error) throw error;
      } else {
        // For managers, we might update the profiles table directly if the user exists,
        // or we need a 'managers' table. Assuming profiles for now.
        // If the user doesn't exist in Auth, we can't really insert into profiles (FK constraint).
        // So usually you create a "Invite" or just insert into a 'managers' table if you have one.
        
        toast({ title: "Manager Setup", description: "Manager creation usually requires the user to sign up first. Feature coming soon." });
        return;
      }

      toast({ title: "Success", description: `${newStaffRole} added successfully.` });
      setIsDialogOpen(false);
      setNewStaffName('');
      setNewStaffEmail('');
      setSelectedBatches([]);
      setSelectedSubjects([]);
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });

    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, role: 'teacher' | 'manager') => {
    if (!confirm("Are you sure? This cannot be undone.")) return;
    setIsDeleting(id);
    try {
      if (role === 'teacher') {
        await supabase.from('teachers').delete().eq('id', id);
      } else {
        // For managers (profiles), we usually just downgrade them to 'student' or delete?
        // Let's just update role to NULL or 'student'
        await supabase.from('profiles').update({ role: 'student' }).eq('id', id);
      }
      toast({ title: "Deleted", description: "Staff member removed." });
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Staff Management</h2>
          <p className="text-muted-foreground">Manage Teachers and Managers access.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Staff
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Staff Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input 
                    value={newStaffName} 
                    onChange={(e) => setNewStaffName(e.target.value)} 
                    placeholder="John Doe" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select 
                    value={newStaffRole} 
                    onValueChange={(val: any) => setNewStaffRole(val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="teacher">Teacher</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input 
                  value={newStaffEmail} 
                  onChange={(e) => setNewStaffEmail(e.target.value)} 
                  placeholder="john@example.com" 
                />
              </div>

              {/* DYNAMIC MULTI-SELECT DROPDOWNS */}
              {newStaffRole === 'teacher' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Assigned Batches</label>
                    <MultiSelect 
                      options={uniqueData?.batches || []} 
                      selected={selectedBatches}
                      onChange={setSelectedBatches}
                      placeholder="Select batches..."
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Assigned Subjects</label>
                    <MultiSelect 
                      options={uniqueData?.subjects || []} 
                      selected={selectedSubjects}
                      onChange={setSelectedSubjects}
                      placeholder="Select subjects..."
                    />
                  </div>
                </>
              )}

            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateStaff} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-lg bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Batches</TableHead>
              <TableHead>Subjects</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
               <TableRow>
                 <TableCell colSpan={5} className="text-center h-24">
                   <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                 </TableCell>
               </TableRow>
            ) : staff?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                  No staff members found.
                </TableCell>
              </TableRow>
            ) : (
              staff?.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{member.name}</span>
                      <span className="text-xs text-muted-foreground">{member.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.role === 'manager' ? "default" : "secondary"}>
                      {member.role === 'manager' ? <Shield className="h-3 w-3 mr-1" /> : <GraduationCap className="h-3 w-3 mr-1" />}
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {member.batches && member.batches.length > 0 
                        ? member.batches.slice(0, 2).map((b, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">{b}</Badge>
                        ))
                        : <span className="text-muted-foreground text-xs">-</span>
                      }
                      {member.batches && member.batches.length > 2 && (
                        <Badge variant="outline" className="text-[10px]">+{member.batches.length - 2}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {member.subjects && member.subjects.length > 0 
                        ? member.subjects.slice(0, 2).map((s, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">{s}</Badge>
                        ))
                        : <span className="text-muted-foreground text-xs">-</span>
                      }
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(member.id, member.role)}
                      disabled={isDeleting === member.id}
                    >
                      {isDeleting === member.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
