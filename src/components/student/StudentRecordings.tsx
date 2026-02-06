import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Video, Play, Search, ArrowLeft, PlayCircle, MessageSquare, Send, CornerDownRight, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Interfaces
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

// Skeletons
const RecordingSkeleton = () => (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm border border-slate-200 p-3.5 h-[360px] animate-pulse">
                <div className="h-[210px] bg-slate-200 rounded-md w-full mb-5" />
                <div className="space-y-3 px-2">
                    <div className="flex justify-between">
                        <div className="h-4 bg-slate-200 rounded w-24" />
                        <div className="h-4 bg-slate-200 rounded w-16" />
                    </div>
                    <div className="h-6 bg-slate-200 rounded w-3/4" />
                </div>
            </div>
        ))}
    </div>
);

// Player Component
const WatermarkedPlayer = ({ recording }: { recording: RecordingContent }) => {
    const { profile } = useAuth();
    return (
        <div className="relative aspect-video" onContextMenu={(e) => e.preventDefault()}>
            <iframe
                src={recording.embed_link}
                className="absolute top-0 left-0 w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={recording.topic}
            />
            <div className="absolute top-2 left-2 bg-black/50 text-white/80 text-xs px-2 py-1 rounded-full pointer-events-none backdrop-blur-sm">
                {profile?.email}
            </div>
            <div className="absolute bottom-2 right-2 pointer-events-none">
                <img 
                    src="https://res.cloudinary.com/dkywjijpv/image/upload/v1769193106/UI_Logo_yiput4.png" 
                    alt="Logo" 
                    className="h-10 w-auto opacity-60" 
                />
            </div>
        </div>
    );
};

// Doubts Section Component
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
        <div className="mt-8 bg-white rounded-2xl shadow-lg border border-slate-100">
            <div className="p-6 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-800 flex items-center">
                    <MessageSquare className="mr-3 text-teal-600" /> Doubts & Discussions
                </h2>
            </div>
            <div className="p-6">
                <div className="flex items-start space-x-4">
                    <Avatar>
                        <AvatarFallback>{user?.email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <Textarea 
                            placeholder="Ask a question about this recording..." 
                            value={newDoubt} 
                            onChange={e => setNewDoubt(e.target.value)} 
                            className="bg-slate-50 focus:bg-white border-slate-200"
                        />
                        <Button 
                            onClick={() => addDoubtMutation.mutate(newDoubt)} 
                            disabled={!newDoubt.trim() || addDoubtMutation.isPending}
                            className="mt-3 bg-teal-600 hover:bg-teal-700"
                        >
                            <Send className="mr-2 h-4 w-4" /> Ask Question
                        </Button>
                    </div>
                </div>
                
                <div className="mt-8 space-y-2">
                    {isLoadingDoubts ? <Skeleton className="h-20 w-full" /> : (
                        <Accordion type="single" collapsible className="w-full">
                            {doubts.map(doubt => (
                                <AccordionItem key={doubt.id} value={doubt.id} className="border-b-0 mb-2">
                                    <AccordionTrigger className="p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                        <div className="flex items-center gap-3 text-left w-full">
                                            <Avatar className="h-9 w-9">
                                                <AvatarFallback className="bg-teal-100 text-teal-800">{doubt.profiles?.name?.charAt(0) || '?'}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <div className="font-semibold text-slate-800">{doubt.profiles?.name || 'A student'}</div>
                                                <div className="font-normal text-sm text-slate-600 truncate">{doubt.question_text}</div>
                                            </div>
                                            <div className="text-xs text-slate-400 ml-4 flex-shrink-0">
                                                {formatDistanceToNow(new Date(doubt.created_at), { addSuffix: true })}
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pt-4 pb-2 pl-16">
                                        <div className="space-y-4">
                                            {(answersByDoubtId[doubt.id] || []).map(answer => (
                                                <div key={answer.id} className="flex items-start space-x-3">
                                                    <Avatar className="h-8 w-8">
                                                        <AvatarFallback>{answer.profiles?.name?.charAt(0) || '?'}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 bg-slate-50 rounded-lg p-3">
                                                        <div className="flex justify-between items-center">
                                                            <p className="font-semibold text-sm text-slate-800">{answer.profiles?.name || 'A student'}</p>
                                                            <p className="text-xs text-slate-500">{formatDistanceToNow(new Date(answer.created_at), { addSuffix: true })}</p>
                                                        </div>
                                                        <p className="mt-1 text-sm text-slate-700">{answer.answer_text}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="mt-4 flex items-start space-x-3">
                                            <Avatar className="h-8 w-8">
                                                 <AvatarFallback>{user?.email?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <Textarea 
                                                    placeholder="Write an answer..." 
                                                    value={newAnswers[doubt.id] || ''} 
                                                    onChange={e => setNewAnswers(prev => ({...prev, [doubt.id]: e.target.value}))} 
                                                    className="text-sm bg-white border-slate-200"
                                                />
                                                <Button 
                                                    size="sm" 
                                                    onClick={() => addAnswerMutation.mutate({ doubt_id: doubt.id, answer_text: newAnswers[doubt.id] })} 
                                                    disabled={!newAnswers[doubt.id]?.trim() || addAnswerMutation.isPending}
                                                    className="mt-2 bg-teal-600 hover:bg-teal-700"
                                                >
                                                    <CornerDownRight className="mr-2 h-4 w-4" /> Reply
                                                </Button>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    )}
                    {doubts.length === 0 && !isLoadingDoubts && (
                        <div className="text-center py-10 text-slate-500">
                            <MessageSquare className="mx-auto h-12 w-12 text-slate-300" />
                            <p className="mt-4">No questions have been asked for this recording yet.</p>
                            <p>Be the first to start a discussion!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


// Main Component
export const StudentRecordings = ({ batch, subject }: StudentRecordingsProps) => {
    const { profile } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRecording, setSelectedRecording] = useState<RecordingContent | null>(null);
    const isMobile = useIsMobile();

    // Direct query when batch/subject props are provided (context-aware mode)
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

    const getSubjectInitials = (subj: string) => {
        if (!subj) return 'CS';
        return subj.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    if (selectedRecording) {
        return (
            <div className="p-4 md:p-6 space-y-6 bg-[#f1f5f9] min-h-full">
                <Button variant="outline" onClick={() => setSelectedRecording(null)} className="mb-4 bg-white hover:bg-slate-50">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Lectures
                </Button>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card className="bg-white rounded-2xl overflow-hidden shadow-xl border-none">
                            <CardHeader className="p-6 border-b border-slate-100">
                                <CardTitle className="text-slate-800">{selectedRecording.topic}</CardTitle>
                                <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    {format(new Date(selectedRecording.date), 'MMMM d, yyyy')}
                                </p>
                            </CardHeader>
                            <CardContent className="p-0">
                                <WatermarkedPlayer recording={selectedRecording} />
                            </CardContent>
                        </Card>
                        <DoubtsSection recording={selectedRecording} />
                    </div>
                    
                    {/* Sidebar Suggestions */}
                    <div className="lg:col-span-1">
                        <Card className="bg-white rounded-2xl shadow-lg sticky top-4 border-none">
                            <CardHeader className="pb-3"><CardTitle className="text-lg text-slate-800">Other Lectures</CardTitle></CardHeader>
                            <CardContent>
                                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                                    {filteredRecordings.filter(r => r.id !== selectedRecording.id).map((rec, idx) => (
                                        <div 
                                            key={rec.id} 
                                            className="group flex gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors" 
                                            onClick={() => handleSelectRecording(rec)}
                                        >
                                            <div className="relative w-24 h-14 bg-slate-200 rounded-md overflow-hidden flex-shrink-0">
                                                 {/* Mini Thumbnail */}
                                                <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                                                    <PlayCircle className="h-6 w-6 text-white/70" />
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-sm text-slate-800 line-clamp-2 group-hover:text-teal-600 transition-colors">
                                                    {rec.topic}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    {format(new Date(rec.date), 'MMM d')}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-8 bg-[#f1f5f9] min-h-full font-sans">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center tracking-tight">
                        Lectures
                    </h1>
                    <p className="text-slate-500 mt-1">Watch recorded classes for {subject}</p>
                </div>
                
                {/* Search */}
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search topics..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-10 bg-white border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                    />
                </div>
            </div>

            {/* Recordings Grid - Premium Cards */}
            <div>
                {isLoading ? (
                    <RecordingSkeleton />
                ) : filteredRecordings.length > 0 ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                        {filteredRecordings.map((recording, index) => {
                            // Calculate lecture number based on total count and index (assuming filtered desc)
                            const lectureNo = filteredRecordings.length - index; 
                            
                            return (
                                <div 
                                    key={recording.id}
                                    onClick={() => handleSelectRecording(recording)}
                                    className={cn(
                                        "w-full bg-white rounded-lg p-3.5",
                                        "shadow-[0_10px_25px_-5px_rgba(0,0,0,0.05)]",
                                        "border border-slate-200",
                                        "cursor-pointer transition-all duration-300",
                                        "hover:shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1)] hover:-translate-y-1"
                                    )}
                                >
                                    {/* Visual Banner */}
                                    <div className="h-[210px] w-full bg-gradient-to-br from-white to-[#f0fdfa] rounded-md relative flex items-center px-8 border border-[#ccfbf1] overflow-hidden group">
                                        
                                        {/* Banner Text - Lecture No ONLY (Duration Removed) */}
                                        <div className="z-10 relative">
                                            <span className="text-[#0d9488] font-bold text-3xl block mb-0.5 tracking-tight">
                                                Lecture {lectureNo}
                                            </span>
                                        </div>

                                        {/* Graphic Elements (Right) */}
                                        <div className="absolute right-5 top-1/2 -translate-y-1/2">
                                            {/* Logo Circle */}
                                            <div className="w-[140px] h-[140px] bg-[#111] rounded-full flex items-center justify-center border-[10px] border-[#f0fdfa] shadow-sm select-none overflow-hidden p-4">
                                                <img 
                                                    src="https://res.cloudinary.com/dkywjijpv/image/upload/v1769193106/UI_Logo_yiput4.png" 
                                                    alt="UI Logo" 
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>
                                            {/* Play Button Overlay */}
                                            <div className="absolute bottom-1 right-1 w-[54px] h-[54px] bg-[#0d9488] rounded-full flex items-center justify-center text-white border-4 border-white shadow-[0_4px_12px_rgba(13,148,136,0.3)] z-20 group-hover:scale-110 transition-transform duration-300">
                                                <Play fill="white" className="w-5 h-5 ml-1" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Info Footer */}
                                    <div className="pt-5 px-2.5 pb-2.5">
                                        <div className="flex justify-between items-center mb-3.5 text-slate-500 font-medium text-[15px]">
                                            <span>{format(new Date(recording.date), 'dd MMMM, yyyy')}</span>
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-[18px] opacity-80" />
                                                <span>{format(new Date(recording.date), 'h:mm a')}</span>
                                            </div>
                                        </div>
                                        <h2 className="text-[21px] font-bold text-slate-900 tracking-tight leading-snug line-clamp-2">
                                            {recording.topic}
                                        </h2>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                        <div className="inline-block bg-slate-50 rounded-full p-4 mb-4">
                            <PlayCircle className="h-10 w-10 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">No Lectures Found</h3>
                        <p className="text-slate-500">No recorded lectures are available for this subject.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
