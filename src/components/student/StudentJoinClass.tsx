import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Lock, Radio } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface ActiveClass {
    batch: string;
    subject: string;
    room_url: string;
}

export const StudentJoinClass = () => {
    const { profile, user } = useAuth();
    const [activeClasses, setActiveClasses] = useState<ActiveClass[]>([]);

    // 1. Get Student's Enrollments
    const { data: enrollments, isLoading } = useQuery({
        queryKey: ['studentEnrollments', user?.id],
        queryFn: async () => {
            if (!user?.id) return [];
            const { data } = await supabase
                .from('user_enrollments')
                .select('batch_name, subject_name')
                .eq('user_id', user.id);
            return data || [];
        },
        enabled: !!user?.id
    });

    useEffect(() => {
        if (!enrollments || enrollments.length === 0) return;

        // Create a list of batches this student is part of
        const myBatches = enrollments.map(e => e.batch_name);

        // 2. Initial Fetch of Active Classes matching my batches
        const fetchActiveClasses = async () => {
            const { data } = await supabase
                .from('active_classes')
                .select('*')
                .in('batch', myBatches); // Filter by MY batches
            
            if (data) setActiveClasses(data);
        };
        fetchActiveClasses();

        // 3. Realtime Listener
        // We listen to ALL changes in active_classes, but filter in UI or via RLS
        const channel = supabase
            .channel('public:active_classes')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'active_classes' 
            }, (payload) => {
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    const newClass = payload.new as ActiveClass;
                    // Only add if it belongs to one of my batches
                    if (myBatches.includes(newClass.batch)) {
                        setActiveClasses(prev => {
                            // Avoid duplicates
                            const filtered = prev.filter(c => c.batch !== newClass.batch || c.subject !== newClass.subject);
                            return [...filtered, newClass];
                        });
                        toast.success(`${newClass.subject} class started!`);
                    }
                } 
                else if (payload.eventType === 'DELETE') {
                    const oldClass = payload.old as ActiveClass;
                    setActiveClasses(prev => prev.filter(c => 
                        !(c.batch === oldClass.batch && c.subject === oldClass.subject)
                    ));
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [enrollments]);

    const handleJoin = async (cls: ActiveClass) => {
        if (!cls.room_url) return;

        try {
            // Log Attendance
            await supabase.from('class_attendance').insert({
                user_id: user?.id,
                user_name: profile?.name || user?.email,
                user_role: 'student',
                batch: cls.batch,
                subject: cls.subject,
                joined_at: new Date().toISOString(),
                status: 'present'
            });

            // Open the Secure Link
            window.open(cls.room_url, '_blank');
        } catch (error) {
            console.error("Attendance error", error);
            // Open link anyway even if attendance fails (optional fallback)
            window.open(cls.room_url, '_blank'); 
        }
    };

    if (isLoading) return <Skeleton className="h-32 w-full" />;

    if (activeClasses.length === 0) {
        return (
            <Card className="bg-muted/50 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                        <Radio className="h-6 w-6 opacity-50" />
                    </div>
                    <p>No classes are live right now.</p>
                    <p className="text-xs">Wait here, the button will appear when teacher joins.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {activeClasses.map((cls, idx) => (
                <Card key={`${cls.batch}-${cls.subject}-${idx}`} className="bg-gradient-to-r from-blue-900 to-indigo-900 border-blue-500 shadow-xl overflow-hidden relative">
                    {/* Pulsing Dot */}
                    <div className="absolute top-4 right-4 flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        <span className="text-xs font-bold text-green-400 uppercase tracking-wider">Live</span>
                    </div>

                    <CardHeader className="pb-2">
                        <CardTitle className="text-white flex flex-col">
                            <span className="text-2xl">{cls.subject}</span>
                            <span className="text-sm font-normal text-blue-200">{cls.batch}</span>
                        </CardTitle>
                    </CardHeader>
                    
                    <CardContent>
                        <div className="flex items-center gap-2 text-blue-200 text-xs mb-4 bg-blue-950/50 p-2 rounded w-fit">
                            <Lock className="w-3 h-3" /> 
                            Secure Connection • Attendance Auto-Marked
                        </div>

                        <Button 
                            onClick={() => handleJoin(cls)}
                            className="w-full bg-green-600 hover:bg-green-700 h-12 text-lg font-bold transition-all hover:scale-[1.02] shadow-lg shadow-green-900/20"
                        >
                            <ExternalLink className="mr-2 w-5 h-5" />
                            Join Now
                        </Button>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};
