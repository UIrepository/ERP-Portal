import { useState, useMemo } from 'react';
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
import {
  Loader2,
  Plus,
  Trash2,
  Shield,
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
  disabled?: boolean;
}

const MultiSelect = ({ options, selected, onChange, placeholder, disabled }: MultiSelectProps) => {
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
          disabled={disabled}
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
              <ScrollArea className="h-64">
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
              </ScrollArea>
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

  // 1. Fetch Staff List (Combined Teachers & Managers)
  const { data: staff, isLoading } = useQuery({
    queryKey: ['admin-staff'],
    queryFn: async () => {
      // Fetch teachers
      const { data: teachers, error: tError } = await supabase
        .from('teachers')
        .select('*');
      if (tError) throw tError;

      // Fetch managers
      const { data: managers, error: mError } = await supabase
        .from('managers')
        .select('*');
      
      if (mError) {
        console.error('Error fetching managers:', mError);
      }

      const formattedTeachers = (teachers || []).map((t) => ({
        id: t.id,
        user_id: t.user_id,
        name: t.name,
        email: t.email,
        role: 'teacher' as const,
        batches: t.assigned_batches || [],
        subjects: t.assigned_subjects || [],
      }));

      const formattedManagers = (managers || []).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        name: m.name,
        email: m.email,
        role: 'manager' as const,
        batches: m.assigned_batches || [],
        subjects: [],
      }));

      return [...formattedTeachers, ...formattedManagers];
    },
  });

  // 2. Fetch Raw Enrollments
  const { data: rawEnrollments } = useQuery({
    queryKey: ['raw-enrollments-staff'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_enrollments')
        .select('batch_name, subject_name');
      
      if (error) {
        console.error("Error fetching enrollments", error);
        return [];
      }
      return data || [];
    }
  });

  // 3. Compute Unique Batches
  const uniqueBatches = useMemo(() => {
    const batches = new Set(rawEnrollments?.map(e => e.batch_name).filter(Boolean));
    return Array.from(batches).sort();
  }, [rawEnrollments]);

  // 4. Compute Dynamic Subjects (Only for Teachers)
  const availableSubjects = useMemo(() => {
    if (selectedBatches.length === 0 || !rawEnrollments) return [];

    const filteredEnrollments = rawEnrollments.filter(e => 
      e.batch_name && selectedBatches.includes(e.batch_name) && e.subject_name
    );

    const subjectOptions = new Set(
      filteredEnrollments.map(e => `${e.subject_name} (${e.batch_name})`)
    );

    return Array.from(subjectOptions).sort();
  }, [selectedBatches, rawEnrollments]);


  const handleCreateStaff = async () => {
    if (!newStaffName || !newStaffEmail) {
      toast({ title: "Missing Fields", description: "Name and Email are required.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      if (newStaffRole === 'teacher') {
        const { error } = await supabase.from('teachers').insert({
          name: newStaffName,
          email: newStaffEmail,
          assigned_batches: selectedBatches,
          assigned_subjects: selectedSubjects, 
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('managers').insert({
          name: newStaffName,
          email: newStaffEmail,
          assigned_batches: selectedBatches, 
        });
        
        if (error) throw error;
      }

      toast({ title: "Success", description: `${newStaffRole} added successfully.` });
      setIsDialogOpen(false);
      setNewStaffName('');
      setNewStaffEmail('');
      setSelectedBatches([]);
      setSelectedSubjects([]);
      queryClient.invalidateQueries({ queryKey: ['admin-staff'] });

    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: error.message || "Failed to create staff member", variant: "destructive" });
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
        await supabase.from('managers').delete().eq('id', id);
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
                    placeholder="Enter staff name" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role</label>
                  <Select 
                    value={newStaffRole} 
                    onValueChange={(val: any) => {
                      setNewStaffRole(val);
                      if (val === 'manager') setSelectedSubjects([]);
                    }}
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
                  placeholder="Enter email address" 
                />
              </div>

              {/* BATCH SELECTOR - VISIBLE FOR BOTH ROLES */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Assigned Batches</label>
                <MultiSelect 
                  options={uniqueBatches} 
                  selected={selectedBatches}
                  onChange={(newBatches) => {
                     setSelectedBatches(newBatches);
                  }}
                  placeholder="Select batches..."
                />
              </div>
                  
              {/* SUBJECT SELECTOR - ONLY FOR TEACHERS */}
              {newStaffRole === 'teacher' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Assigned Subjects (Filtered by Batch)</label>
                    <MultiSelect 
                      options={availableSubjects} 
                      selected={selectedSubjects}
                      onChange={setSelectedSubjects}
                      placeholder={selectedBatches.length > 0 ? "Select subjects..." : "Select a batch first"}
                      disabled={selectedBatches.length === 0}
                    />
                    {selectedBatches.length === 0 && (
                        <p className="text-[10px] text-muted-foreground">
                            * Please select a batch to see available subjects.
                        </p>
                    )}
                  </div>
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
                      {member.subjects && member.subjects.length > 2 && (
                          <Badge variant="outline" className="text-[10px]">+{member.subjects.length - 2}</Badge>
                      )}
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
