import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JitsiMeeting } from '@/components/JitsiMeeting';
import { toast } from 'sonner';
import { Video } from 'lucide-react';

export const TeacherJoinClass = () => {
  const { profile } = useAuth();
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  
  // State for the Active Meeting Room
  const [activeMeeting, setActiveMeeting] = useState<{
    roomName: string;
    subject: string;
    batch: string;
  } | null>(null);

  // Hardcoded for demo - replace with your real data if needed
  const batches = ["Unknown IITians Batch A", "Unknown IITians Batch B"];
  const subjects = ["Physics", "Mathematics", "Chemistry"];

  const handleStartClass = async () => {
    if (!selectedBatch || !selectedSubject) {
        toast.error("Please select Batch and Subject");
        return;
    }

    // 1. GENERATE SECRET ROOM ID (Virtual Whitelist)
    // FIX: Using native crypto.randomUUID() instead of 'uuid' package
    const secretId = crypto.randomUUID().slice(0, 8);
    const roomName = `UnknownIITians-${selectedSubject.replace(/\s+/g, '')}-${secretId}`;

    // 2. SAVE TO DB (So students can find it)
    const { error } = await supabase.from('active_classes').upsert({
        batch: selectedBatch,
        subject: selectedSubject,
        room_id: roomName,
        teacher_id: profile?.user_id,
        started_at: new Date().toISOString()
    }, { onConflict: 'batch,subject' });

    if (error) {
        toast.error("Database Error: Could not create class session.");
        console.error(error);
        return;
    }

    // 3. LAUNCH UI
    setActiveMeeting({ roomName, subject: selectedSubject, batch: selectedBatch });
    toast.success("Class Started! Lobby is Auto-Enabled.");
  };

  const handleEndClass = async () => {
      if (!confirm("End the class for everyone?")) return;

      // DELETE FROM DB (Students can no longer find/join)
      await supabase.from('active_classes').delete().match({ 
          batch: activeMeeting?.batch, 
          subject: activeMeeting?.subject 
      });

      setActiveMeeting(null);
      window.location.reload();
  };

  // 🔴 LIVE CLASS UI
  if (activeMeeting) {
    return (
        <JitsiMeeting
            roomName={activeMeeting.roomName}
            displayName={profile?.name || "Teacher"}
            subject={activeMeeting.subject}
            batch={activeMeeting.batch}
            userRole="teacher"
            onClose={handleEndClass}
        />
    );
  }

  // 🟢 SELECTION UI
  return (
    <div className="p-6 flex items-center justify-center min-h-[80vh]">
      <Card className="w-full max-w-md border-gray-700 bg-gray-800 text-white">
        <CardHeader>
            <CardTitle className="text-center text-blue-400">Launch Live Class</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="space-y-2">
                <Label>Batch</Label>
                <Select onValueChange={setSelectedBatch}>
                    <SelectTrigger className="bg-gray-700"><SelectValue placeholder="Select Batch" /></SelectTrigger>
                    <SelectContent className="bg-gray-700 text-white">{batches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label>Subject</Label>
                <Select onValueChange={setSelectedSubject}>
                    <SelectTrigger className="bg-gray-700"><SelectValue placeholder="Select Subject" /></SelectTrigger>
                    <SelectContent className="bg-gray-700 text-white">{subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
            </div>
            <Button onClick={handleStartClass} className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg">
                <Video className="mr-2 w-5 h-5" /> Start Live Class
            </Button>
        </CardContent>
      </Card>
    </div>
  );
};
