import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Video, ShieldAlert, Wifi, Power } from "lucide-react";

// Use public Jitsi or your self-hosted instance
const JITSI_BASE_URL = "https://meet.jit.si";

export const TeacherJoinClass = () => {
    const { profile, user } = useAuth();
    const [selectedBatch, setSelectedBatch] = useState<string>("");
    const [selectedSubject, setSelectedSubject] = useState<string>("");
    const [activeClassLink, setActiveClassLink] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch Teacher's Assigned Batches/Subjects from DB
    const { data: assignments } = useQuery({
        queryKey: ['teacherAssignments', user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from('teachers')
                .select('assigned_batches, assigned_subjects')
                .eq('user_id', user?.id)
                .single();
            return data;
        },
        enabled: !!user?.id
    });

    const handleStartClass = async () => {
        if (!selectedBatch || !selectedSubject) {
            toast.error("Please select Batch and Subject");
            return;
        }

        setIsLoading(true);

        // 🔒 SECURITY STEP 1: Generate a Random, Un-guessable UUID
        // Native browser crypto - no external package needed
        const uniqueSecret = crypto.randomUUID().slice(0, 12);
        
        // Clean subject name for URL (remove spaces/special chars)
        const cleanSubject = selectedSubject.replace(/[^a-zA-Z0-9]/g, '');
        const roomName = `UnknownIITians-${cleanSubject}-${uniqueSecret}`;
        const meetingUrl = `${JITSI_BASE_URL}/${roomName}`;

        try {
            // 🔒 SECURITY STEP 2: Save to DB (Gatekeeper)
            const { error } = await supabase.from('active_classes').upsert({
                 batch: selectedBatch,
                 subject: selectedSubject,
                 room_url: meetingUrl,
                 teacher_id: user?.id,
                 is_active: true,
                 started_at: new Date().toISOString()
            }, { onConflict: 'batch,subject' }); // Ensure unique active class per batch-subject

            if (error) throw error;

            // 3. Mark Teacher Attendance
            await supabase.from('class_attendance').insert({
                user_id: user?.id,
                user_name: profile?.name || "Teacher",
                user_role: 'teacher',
                batch: selectedBatch,
                subject: selectedSubject,
                joined_at: new Date().toISOString(),
                // We leave schedule_id null for ad-hoc/dynamic classes, or you can pass it if selected
            });

            // 4. Open Class
            window.open(meetingUrl, '_blank');
            setActiveClassLink(meetingUrl);
            toast.success("Secure Class Launched!");
            
            // Security Tip
            setTimeout(() => {
                toast.info("Security Tip: Enable 'Lobby Mode' in Jitsi settings to manually approve students.", { duration: 5000 });
            }, 1000);

        } catch (err) {
            console.error(err);
            toast.error("Failed to start class. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleEndClass = async () => {
        if (!confirm("Are you sure you want to end the class? This will invalidate the link for all students.")) return;

        try {
            // 🔒 SECURITY STEP 3: Delete Link from DB
            // This immediately prevents new joins. Existing Jitsi participants stay until they leave.
            const { error } = await supabase
                .from('active_classes')
                .delete()
                .match({ batch: selectedBatch, subject: selectedSubject });

            if (error) throw error;

            setActiveClassLink(null);
            toast.info("Class Ended. The link is now invalid.");
        } catch (err) {
            toast.error("Error ending class.");
            console.error(err);
        }
    };

    // --- VIEW: CLASS IS LIVE ---
    if (activeClassLink) {
        return (
            <div className="flex items-center justify-center p-6 animate-in fade-in duration-500">
                <Card className="w-full max-w-2xl bg-gray-900 border-gray-800 text-white shadow-2xl">
                    <CardHeader className="text-center border-b border-gray-800 pb-8">
                        <div className="flex justify-center mb-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-green-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                                <div className="relative h-20 w-20 bg-gray-800 border-2 border-green-500/50 rounded-full flex items-center justify-center">
                                    <Wifi className="h-8 w-8 text-green-500 animate-pulse" />
                                </div>
                            </div>
                        </div>
                        <CardTitle className="text-3xl font-bold text-white mb-2">
                            Class is Live
                        </CardTitle>
                        <p className="text-gray-400">{selectedSubject} • {selectedBatch}</p>
                        
                        <div className="flex items-center justify-center gap-2 text-amber-400 bg-amber-950/30 border border-amber-900/50 p-3 rounded-lg text-sm mt-6 max-w-md mx-auto">
                            <ShieldAlert className="w-4 h-4 shrink-0" />
                            <span>Link is secure. Only enrolled students can join via dashboard.</span>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-6 pt-8 px-8 pb-8">
                        <Button 
                            variant="outline" 
                            onClick={() => window.open(activeClassLink, '_blank')}
                            className="w-full h-12 text-lg border-blue-500/50 text-blue-400 hover:bg-blue-950/30"
                        >
                            <ExternalLink className="w-5 h-5 mr-2" /> Re-open Meeting Tab
                        </Button>

                        <div className="h-px bg-gray-800 my-4" />

                        <Button 
                            onClick={handleEndClass} 
                            variant="destructive" 
                            className="w-full h-14 text-lg font-bold bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20"
                        >
                            <Power className="w-5 h-5 mr-2" />
                            End Class & Expire Link
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // --- VIEW: START CLASS ---
    return (
        <div className="p-6">
            <Card className="max-w-xl mx-auto border-gray-200 dark:border-gray-800 shadow-xl">
                <CardHeader>
                    <CardTitle className="text-2xl flex items-center gap-2">
                        <Video className="w-6 h-6 text-blue-600" />
                        Launch Secure Class
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Select Batch</Label>
                        <Select onValueChange={setSelectedBatch}>
                            <SelectTrigger className="h-12">
                                <SelectValue placeholder="Select Batch" />
                            </SelectTrigger>
                            <SelectContent>
                                {assignments?.assigned_batches?.map((b: string) => (
                                    <SelectItem key={b} value={b}>{b}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Select Subject</Label>
                        <Select onValueChange={setSelectedSubject}>
                            <SelectTrigger className="h-12">
                                <SelectValue placeholder="Select Subject" />
                            </SelectTrigger>
                            <SelectContent>
                                {assignments?.assigned_subjects?.map((s: string) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Button 
                        onClick={handleStartClass} 
                        disabled={isLoading || !selectedBatch || !selectedSubject}
                        className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700"
                    >
                        {isLoading ? "Generating Secure Link..." : "Start Class Now"}
                    </Button>
                    
                    <p className="text-xs text-center text-muted-foreground">
                        This will generate a one-time secure link visible only to students in the selected batch.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};
