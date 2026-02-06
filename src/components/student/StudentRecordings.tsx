import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
    Video, 
    Play, 
    Search, 
    ArrowLeft, 
    PlayCircle, 
    MessageSquare, 
    Send, 
    CornerDownRight, 
    Clock, 
    ChevronLeft,
    Calendar,
    FileText
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

// --- Interfaces ---
interface RecordingContent {
    id: string;
    date: string;
    subject: string;
    topic: string;
    embed_link: string;
    batch: string;
    created_at: string;
}

interface StudentRecordingsProps {
    batch?: string;
    subject?: string;
}

interface Profile {
    name: string;
}

interface Doubt {
    id: string;
    question_text: string;
    created_at: string;
    user_id: string;
    profiles: Profile | null;
}

interface DoubtAnswer {
    id: string;
    answer_text: string;
    created_at: string;
    user_id: string;
    doubt_id: string;
    profiles: Profile | null;
}

// --- Sub-Components ---

const WatermarkedPlayer = ({ recording }: { recording: RecordingContent }) => {
    const { profile } = useAuth();
    return (
        <div className="relative aspect-video bg-black rounded-md overflow-hidden" onContextMenu={(e) => e.preventDefault()}>
            <iframe
                src={recording.embed_link}
                className="absolute top-0 left-0 w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={recording.topic}
            />
            <div className="absolute top-2 left-2 bg-black/50 text-white/80 text-[10px] px-2 py-0.5 rounded-full pointer-events-none backdrop-blur-sm">
                {profile?.email}
            </div>
            <div className="absolute bottom-2 right-2 pointer-events-none">
                <img 
                    src="https://res.cloudinary.com/dkywjijpv/image/upload/v1769193106/UI_Logo_yiput4.png" 
                    alt="Logo" 
                    className="h-8 w-auto opacity-50" 
                />
            </div>
        </div>
    );
};

const DoubtsSection = ({ recording }: { recording: RecordingContent }) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [newDoubt, setNewDoubt] = useState('');
    const [newAnswers, setNewAnswers] = useState<Record<string, string>>({});

    const { data: doubts = [], isLoading: isLoadingDoubts } = useQuery<Doubt[]>({
        queryKey: ['doubts', recording.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('doubts')
                .select(`id, question_text, created_at, user_id, profiles!inner(name)`)
                .eq('recording_id', recording.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data as any[];
        },
        enabled: !!recording.id,
    });

    const doubtIds = useMemo(() => doubts.map(d => d.id), [doubts]);

    const { data: answers = [] } = useQuery<DoubtAnswer[]>({
        queryKey: ['doubt_answers', doubtIds],
        queryFn: async () => {
            if (doubtIds.length === 0) return [];
            const { data, error } = await supabase
                .from('doubt_answers')
                .select(`id, answer_text, created_at, user_id, doubt_id, profiles!inner(name)`)
                .in('doubt_id', doubtIds)
                .order('created_at', { ascending: true });
            if (error) throw error;
            return data as any[];
        },
        enabled: doubtIds.length > 0,
    });
    
    const answersByDoubtId = useMemo(() => {
        return answers.reduce((acc, answer) => {
            (acc[answer.doubt_id] = acc[answer.doubt_id] || []).push(answer);
            return acc;
        }, {} as Record<string, DoubtAnswer[]>);
    }, [answers]);

    const addDoubtMutation = useMutation({
        mutationFn: async (question_text: string) => {
            if (!user) throw new Error("You must be logged in to ask a question.");
            const { error } = await supabase.from('doubts').insert({ 
                recording_id: recording.id, 
                user_id: user.id, 
                question_text,
                batch: recording.batch,
                subject: recording.subject
            });
            if (error) throw error;
        },
        onSuccess: () => {
            setNewDoubt('');
            toast({ title: 'Success', description: 'Your question has been posted.' });
        },
        onError: (e: any) => toast({ title: 'Error posting question', description: e.message, variant: 'destructive' }),
    });

    const addAnswerMutation = useMutation({
        mutationFn: async ({ doubt_id, answer_text }: { doubt_id: string, answer_text: string }) => {
            if (!user) throw new Error("You must be logged in to answer.");
            const { error } = await supabase.from('doubt_answers').insert({ doubt_id, user_id: user.id, answer_text });
            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            setNewAnswers(prev => ({ ...prev, [variables.doubt_id]: '' }));
            toast({ title: 'Success', description: 'Your answer has been posted.' });
        },
        onError: (e: any) => toast({ title: 'Error posting answer', description: e.message, variant: 'destructive' }),
    });

    useEffect(() => {
        const channel = supabase.channel(`recording-doubts-${recording.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'doubts', filter: `recording_id=eq.${recording.id}` }, () => {
                queryClient.invalidateQueries({ queryKey: ['doubts', recording.id] });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'doubt_answers' }, (payload) => {
                if(doubtIds.includes((payload.new as any)?.doubt_id)) {
                    queryClient.invalidateQueries({ queryKey: ['doubt_answers', doubtIds] });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase, recording.id, queryClient, doubtIds]);

    return (
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-4 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center">
                    <MessageSquare className="mr-2 h-4 w-4 text-teal-600" /> Doubts & Discussions
                </h2>
            </div>
            <div className="p-4">
                <div className="flex items-start space-x-3">
                    <Avatar className="h-8 w-8">
                        <AvatarFallback>{user?.email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <Textarea 
                            placeholder="Ask a question..." 
                            value={newDoubt} 
                            onChange={e => setNewDoubt(e.target.value)} 
                            className="bg-slate-50 focus:bg-white border-slate-200 min-h-[80px] text-sm"
                        />
                        <Button 
                            onClick={() => addDoubtMutation.mutate(newDoubt)} 
                            disabled={!newDoubt.trim() || addDoubtMutation.isPending}
                            size="sm"
                            className="mt-2 bg-teal-600 hover:bg-teal-700 h-8"
                        >
                            <Send className="mr-2 h-3 w-3" /> Ask Question
                        </Button>
                    </div>
                </div>
                
                <div className="mt-6 space-y-2">
                    {isLoadingDoubts ? <Skeleton className="h-20 w-full" /> : (
                        <Accordion type="single" collapsible className="w-full">
                            {doubts.map(doubt => (
                                <AccordionItem key={doubt.id} value={doubt.id} className="border-b-0 mb-2">
                                    <AccordionTrigger className="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                        <div className="flex items-center gap-3 text-left w-full">
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback className="bg-teal-100 text-teal-800 text-xs">{doubt.profiles?.name?.charAt(0) || '?'}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm text-slate-800">{doubt.profiles?.name || 'A student'}</div>
                                                <div className="font-normal text-xs text-slate-600 truncate">{doubt.question_text}</div>
                                            </div>
                                            <div className="text-[10px] text-slate-400 ml-2 flex-shrink-0">
                                                {formatDistanceToNow(new Date(doubt.created_at), { addSuffix: true })}
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-3 pb-1 pl-12">
                                        <div className="space-y-3">
                                            {(answersByDoubtId[doubt.id] || []).map(answer => (
                                                <div key={answer.id} className="flex items-start space-x-2.5">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarFallback className="text-[10px]">{answer.profiles?.name?.charAt(0) || '?'}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 bg-slate-50 rounded-lg p-2.5">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <p className="font-medium text-xs text-slate-800">{answer.profiles?.name || 'A student'}</p>
                                                            <p className="text-[10px] text-slate-500">{formatDistanceToNow(new Date(answer.created_at), { addSuffix: true })}</p>
                                                        </div>
                                                        <p className="text-xs text-slate-700">{answer.answer_text}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-3 flex items-start space-x-2.5">
                                            <Avatar className="h-6 w-6">
                                                 <AvatarFallback className="text-[10px]">{user?.email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <Textarea 
                                                    placeholder="Write a reply..." 
                                                    value={newAnswers[doubt.id] || ''} 
                                                    onChange={e => setNewAnswers(prev => ({...prev, [doubt.id]: e.target.value}))} 
                                                    className="text-xs bg-white border-slate-200 min-h-[60px]"
                                                />
                                                <Button 
                                                    size="sm" 
                                                    onClick={() => addAnswerMutation.mutate({ doubt_id: doubt.id, answer_text: newAnswers[doubt.id] })} 
                                                    disabled={!newAnswers[doubt.id]?.trim() || addAnswerMutation.isPending}
                                                    className="mt-2 h-7 text-xs bg-teal-600 hover:bg-teal-700"
                                                >
                                                    <CornerDownRight className="mr-1.5 h-3 w-3" /> Reply
                                                </Button>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    )}
                    {doubts.length === 0 && !isLoadingDoubts && (
                        <div className="text-center py-8 text-slate-500">
                            <MessageSquare className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                            <p className="text-sm">No discussions yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


// --- Main Component ---

export const StudentRecordings = ({ batch, subject }: StudentRecordingsProps) => {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRecording, setSelectedRecording] = useState<RecordingContent | null>(null);
    const isMobile = useIsMobile();

    // Context-aware query
    const { data: recordings, isLoading } = useQuery<RecordingContent[]>({
        queryKey: ['student-recordings', batch, subject],
        queryFn: async (): Promise<RecordingContent[]> => {
            if (!batch || !subject) return [];
            
            const { data, error } = await supabase
                .from('recordings')
                .select('*')
                .eq('batch', batch)
                .eq('subject', subject)
                .order('date', { ascending: false }); // Newest first
            
            if (error) throw error;
            return (data || []) as RecordingContent[];
        },
        enabled: !!batch && !!subject
    });

    const filteredRecordings = useMemo(() => recordings?.filter(rec =>
        rec.topic.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [], [recordings, searchTerm]);

    const logActivity = async (activityType: string, description: string, metadata?: any) => {
        if (!profile?.user_id) return;
        await supabase.from('student_activities').insert({
            user_id: profile.user_id, activity_type: activityType, description, metadata,
            batch: batch || null,
            subject: subject || null,
        });
    };

    const handleSelectRecording = async (recording: RecordingContent) => {
        setSelectedRecording(recording);
        await logActivity('recording_view', `Viewed recording: ${recording.topic}`, {
            recordingId: recording.id, topic: recording.topic
        });
    };

    // --- View: Single Recording Player ---
    if (selectedRecording) {
        return (
            <div className="min-h-screen bg-[#F8F8F8] font-sans pb-10">
                <nav className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10">
                    <button 
                        onClick={() => setSelectedRecording(null)}
                        className="flex items-center gap-2 text-[#1e293b] font-medium text-[15px] hover:opacity-80 transition-opacity"
                    >
                        <ChevronLeft className="h-5 w-5" />
                        Back to Lectures
                    </button>
                </nav>

                <div className="max-w-[1200px] mx-auto mt-8 px-4 md:px-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        <div className="lg:col-span-2">
                            {/* Video Player Card */}
                            <div className="bg-white rounded-md border border-slate-200 shadow-sm overflow-hidden mb-6">
                                <div className="p-6 border-b border-slate-100">
                                    <h2 className="text-[22px] font-bold text-[#1e293b] leading-tight">
                                        {selectedRecording.topic}
                                    </h2>
                                    <p className="text-[13px] text-slate-500 mt-2 flex items-center gap-2">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {format(new Date(selectedRecording.date), 'MMMM d, yyyy')}
                                        <span className="text-slate-300">|</span>
                                        <Clock className="h-3.5 w-3.5" />
                                        {format(new Date(selectedRecording.created_at), 'h:mm a')}
                                    </p>
                                </div>
                                <div className="p-0">
                                    <WatermarkedPlayer recording={selectedRecording} />
                                </div>
                            </div>

                            {/* Doubts Section */}
                            <DoubtsSection recording={selectedRecording} />
                        </div>
                        
                        {/* Sidebar: Other Lectures */}
                        <div className="lg:col-span-1">
                            <div className="bg-white rounded-md border border-slate-200 shadow-sm sticky top-24">
                                <div className="p-6 border-b border-slate-100">
                                    <h3 className="text-[16px] font-semibold text-[#1e293b]">Other Lectures</h3>
                                </div>
                                <div className="p-4">
                                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                                        {filteredRecordings.filter(r => r.id !== selectedRecording.id).map((rec) => (
                                            <button 
                                                key={rec.id} 
                                                className={cn(
                                                    "w-full text-left group flex gap-3 p-3 rounded-[4px] cursor-pointer",
                                                    "border border-transparent hover:border-slate-100 hover:bg-slate-50",
                                                    "transition-all duration-200 hover:scale-[1.01]"
                                                )}
                                                onClick={() => handleSelectRecording(rec)}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-[13px] text-[#1e293b] line-clamp-2 group-hover:text-teal-600 transition-colors">
                                                        {rec.topic}
                                                    </p>
                                                    <p className="text-[11px] text-slate-400 mt-1">
                                                        {format(new Date(rec.date), 'MMM d')}
                                                    </p>
                                                </div>
                                                <div className="flex items-center justify-center">
                                                    <PlayCircle className="h-4 w-4 text-slate-300 group-hover:text-teal-500" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- View: Recordings Grid (Subject Blocks Style) ---
    return (
        <div className="min-h-screen bg-[#F8F8F8] font-sans pb-10">
            
            {/* Top Navbar */}
            <nav className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => navigate(-1)} // Or simpler onBack if passed as prop
                        className="text-[#1e293b] hover:opacity-80 transition-opacity"
                    >
                         <ChevronLeft className="h-5 w-5" />
                    </button>
                    <h1 className="text-[17px] font-bold text-[#1e293b]">Class Lectures</h1>
                </div>
                
                {/* Search */}
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                        placeholder="Search lectures..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-9 text-sm bg-[#F8F8F8] border-transparent focus:bg-white focus:border-slate-200 focus:ring-0"
                    />
                </div>
            </nav>

            {/* Main Content Wrapper */}
            <div className="max-w-[1200px] mx-auto mt-8 px-4 md:px-6">
                <div className="bg-white rounded-md border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-8">
                    
                    <h2 className="text-[26px] font-bold text-[#1e293b] mb-8 tracking-tight">
                        {subject} Recordings
                    </h2>

                    {/* Grid Layout - Matches Subject Blocks */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {isLoading ? (
                            [...Array(4)].map((_, i) => (
                                <Skeleton key={i} className="h-32 w-full rounded-[4px]" />
                            ))
                        ) : filteredRecordings.length > 0 ? (
                            filteredRecordings.map((recording, index) => {
                                const lectureNo = filteredRecordings.length - index;
                                
                                return (
                                    <button
                                        key={recording.id}
                                        onClick={() => handleSelectRecording(recording)}
                                        className={cn(
                                            "group relative w-full text-left",
                                            // Base Styles (White, Rounded, Border, Padding)
                                            "bg-white rounded-[4px]", 
                                            "border border-slate-200", 
                                            "p-6", 
                                            "flex items-stretch gap-5",
                                            // ZOOM ANIMATION on the whole section
                                            "transition-all duration-300 ease-in-out",
                                            "hover:scale-[1.02] hover:shadow-lg hover:border-teal-200",
                                            "active:scale-[0.98]"
                                        )}
                                    >
                                        {/* Teal Bar (Fixed width, full height of flex container) */}
                                        <div className="w-1 bg-teal-500 rounded-full shrink-0 group-hover:bg-teal-600 transition-colors" />

                                        {/* Content Wrapper */}
                                        <div className="flex-1 flex flex-col justify-center min-w-0">
                                            {/* Header Row */}
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-teal-600 font-bold text-[13px] uppercase tracking-wider">
                                                    Lecture {lectureNo}
                                                </span>
                                                <span className="text-[12px] text-slate-400 font-normal">
                                                    {format(new Date(recording.date), 'dd MMM, yyyy')}
                                                </span>
                                            </div>
                                            
                                            {/* Title */}
                                            <h3 className="text-[17px] font-semibold text-[#1e293b] mb-3 leading-snug line-clamp-2 group-hover:text-teal-600 transition-colors">
                                                {recording.topic}
                                            </h3>
                                            
                                            {/* Stats/Footer Row */}
                                            <div className="flex items-center text-[13px] text-[#71717a] font-normal">
                                                <span className="flex items-center gap-1.5">
                                                    <Clock className="h-3.5 w-3.5 opacity-70" />
                                                    {format(new Date(recording.created_at), 'h:mm a')}
                                                </span>
                                                <span className="mx-3 text-[#d4d4d8]">|</span>
                                                <span className="flex items-center gap-1.5 text-teal-600 font-medium">
                                                    <PlayCircle className="h-3.5 w-3.5" />
                                                    Watch Now
                                                </span>
                                            </div>
                                        </div>

                                        {/* Optional: Right Side Icon for visual balance (hidden on very small screens) */}
                                        <div className="hidden sm:flex items-center justify-center pl-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-2 group-hover:translate-x-0">
                                            <div className="bg-teal-50 p-2 rounded-full">
                                                <Play className="h-5 w-5 text-teal-600 fill-teal-600" />
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="col-span-full text-center py-16 text-slate-500">
                                <Video className="mx-auto h-10 w-10 text-slate-200 mb-3" />
                                <p className="text-sm">No lectures found.</p>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};
