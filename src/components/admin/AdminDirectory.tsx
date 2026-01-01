import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, Send, User, Loader2, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

interface StudentNode {
  user_id: string;
  name: string;
  email: string;
  batch_name: string;
  subject_name: string;
}

export const AdminDirectory = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Message Dialog State
  const [messageOpen, setMessageOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentNode | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  // 1. Fetch All Student Enrollments
  const { data: rawEnrollments, isLoading } = useQuery({
    queryKey: ['admin-directory'],
    queryFn: async () => {
      // Fetch enrollments joined with profiles
      // We use !inner to ensure we only get records where the profile exists
      const { data, error } = await supabase
        .from('user_enrollments')
        .select(`
          batch_name,
          subject_name,
          user_id,
          profiles!inner (
            name,
            email,
            role
          )
        `)
        .eq('profiles.role', 'student'); // Only fetch students

      if (error) throw error;
      
      // Flatten the data structure
      return data.map((item: any) => ({
        user_id: item.user_id,
        name: item.profiles.name || 'Unknown',
        email: item.profiles.email || 'No Email',
        batch_name: item.batch_name,
        subject_name: item.subject_name,
      })) as StudentNode[];
    },
  });

  // 2. Compute Unique Batches and Subjects
  const uniqueBatches = Array.from(new Set(rawEnrollments?.map(e => e.batch_name) || [])).sort();
  
  const uniqueSubjects = Array.from(new Set(
    rawEnrollments
      ?.filter(e => selectedBatch === 'all' || e.batch_name === selectedBatch)
      .map(e => e.subject_name) || []
  )).sort();

  // 3. Filter Students based on selection
  const filteredStudents = rawEnrollments?.filter(student => {
    const matchesBatch = selectedBatch === 'all' || student.batch_name === selectedBatch;
    const matchesSubject = selectedSubject === 'all' || student.subject_name === selectedSubject;
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          student.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesBatch && matchesSubject && matchesSearch;
  });

  // Deduplicate students (in case they appear multiple times for different subjects if 'all' is selected)
  const displayedStudents = Array.from(
    new Map(filteredStudents?.map(s => [s.user_id, s])).values()
  );

  const handleSendMessage = async () => {
    if (!selectedStudent || !messageText.trim() || !profile?.user_id) return;
    
    setSending(true);
    try {
      const { error } = await supabase.from('direct_messages').insert({
        sender_id: profile.user_id,
        receiver_id: selectedStudent.user_id,
        content: messageText,
        is_read: false
      });

      if (error) throw error;

      toast({
        title: "Message Sent",
        description: `Successfully sent message to ${selectedStudent.name}`,
      });
      setMessageOpen(false);
      setMessageText('');
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const openMessageDialog = (student: StudentNode) => {
    setSelectedStudent(student);
    setMessageText('');
    setMessageOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-2xl font-bold tracking-tight">Student Directory</h2>
           <p className="text-muted-foreground">Browse students by batch and subject to contact them.</p>
        </div>
      </div>

      {/* FILTERS CARD */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4">
          
          {/* Batch Selector */}
          <div className="flex-1 space-y-2">
            <label className="text-xs font-medium text-gray-500 uppercase">Filter by Batch</label>
            <Select value={selectedBatch} onValueChange={(val) => { setSelectedBatch(val); setSelectedSubject('all'); }}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select Batch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Batches</SelectItem>
                {uniqueBatches.map(batch => (
                  <SelectItem key={batch} value={batch}>{batch}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject Selector */}
          <div className="flex-1 space-y-2">
            <label className="text-xs font-medium text-gray-500 uppercase">Filter by Subject</label>
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger className="bg-white">
                 <SelectValue placeholder="Select Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {uniqueSubjects.map(subject => (
                  <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name Search */}
          <div className="flex-1 space-y-2">
            <label className="text-xs font-medium text-gray-500 uppercase">Search Name</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Search student..." 
                className="pl-9 bg-white" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

        </CardContent>
      </Card>

      {/* RESULTS GRID */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : displayedStudents.length === 0 ? (
        <div className="text-center p-12 border-2 border-dashed rounded-xl bg-gray-50">
          <User className="h-10 w-10 mx-auto text-gray-300 mb-2" />
          <p className="text-gray-500">No students found for this selection.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedStudents.map((student) => (
            <Card key={student.user_id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-start gap-4">
                <Avatar className="h-10 w-10 border">
                  <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${student.name}`} />
                  <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm truncate">{student.name}</h4>
                  <p className="text-xs text-gray-500 truncate mb-2">{student.email}</p>
                  
                  <div className="flex flex-wrap gap-1 mb-3">
                    <Badge variant="secondary" className="text-[10px] h-5">{student.batch_name}</Badge>
                    {student.subject_name && (
                       <Badge variant="outline" className="text-[10px] h-5">{student.subject_name}</Badge>
                    )}
                  </div>

                  <Button 
                    size="sm" 
                    className="w-full h-8 text-xs gap-2" 
                    variant="default"
                    onClick={() => openMessageDialog(student)}
                  >
                    <Mail className="h-3 w-3" />
                    Message
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* SEND MESSAGE DIALOG */}
      <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message {selectedStudent?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-blue-50 text-blue-700 text-sm rounded-md">
              This message will appear in the student's "Mentors & Connect" tab.
            </div>
            <Textarea 
              placeholder="Type your message here..." 
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageOpen(false)}>Cancel</Button>
            <Button onClick={handleSendMessage} disabled={!messageText.trim() || sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Send className="h-4 w-4 mr-2"/>}
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
