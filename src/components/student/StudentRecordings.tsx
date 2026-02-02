import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Video, Play, Search, ArrowLeft, PlayCircle, MessageSquare, Send, CornerDownRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';

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
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-lg overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <div className="p-5 space-y-3">
                    <Skeleton className="h-5 w-4/5 rounded-md" />
                    <Skeleton className="h-4 w-1/2 rounded-md" />
                    <div className="flex gap-2 pt-2">
                        <Skeleton className="h-5 w-20 rounded-full" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
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
                <img src="/logoofficial.png" alt="Logo" className="h-10 w-auto opacity-40" />
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
        <div className="mt-8 bg-white rounded-2xl shadow-lg">
            <div className="p-6 border-b">
                <h2 className="text-xl font-bold text-gray-800 flex items-center">
                    <MessageSquare className="mr-3 text-indigo-500" /> Doubts & Discussions
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
                            className="bg-gray-50 focus:bg-white"
                        />
                        <Button 
                            onClick={() => addDoubtMutation.mutate(newDoubt)} 
                            disabled={!newDoubt.trim() || addDoubtMutation.isPending}
                            className="mt-3"
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
                                    <AccordionTrigger className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                        <div className="flex items-center gap-3 text-left w-full">
                                            <Avatar className="h-9 w-9">
                                                <AvatarFallback>{doubt.profiles?.name?.charAt(0) || '?'}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <div className="font-semibold text-gray-800">{doubt.profiles?.name || 'A student'}</div>
                                                <div className="font-normal text-sm text-gray-600 truncate">{doubt.question_text}</div>
                                            </div>
                                            <div className="text-xs text-gray-400 ml-4 flex-shrink-0">
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
                                                    <div className="flex-1 bg-gray-50 rounded-lg p-3">
                                                        <div className="flex justify-between items-center">
                                                            <p className="font-semibold text-sm text-gray-800">{answer.profiles?.name || 'A student'}</p>
                                                            <p className="text-xs text-gray-500">{formatDistanceToNow(new Date(answer.created_at), { addSuffix: true })}</p>
                                                        </div>
                                                        <p className="mt-1 text-sm text-gray-700">{answer.answer_text}</p>
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
                                                    className="text-sm bg-white"
                                                />
                                                <Button 
                                                    size="sm" 
                                                    onClick={() => addAnswerMutation.mutate({ doubt_id: doubt.id, answer_text: newAnswers[doubt.id] })} 
                                                    disabled={!newAnswers[doubt.id]?.trim() || addAnswerMutation.isPending}
                                                    className="mt-2"
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
                        <div className="text-center py-10 text-gray-500">
                            <MessageSquare className="mx-auto h-12 w-12 text-gray-300" />
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
                .order('date', { ascending: false });
            
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

    if (selectedRecording) {
        return (
            <div className="p-4 md:p-6 space-y-6 bg-slate-100 min-h-full">
                <Button variant="outline" onClick={() => setSelectedRecording(null)} className="mb-4">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Back to Lectures
                </Button>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card className="bg-white rounded-2xl overflow-hidden shadow-2xl">
                            <CardHeader className="p-6 border-b">
                                <CardTitle>{selectedRecording.topic}</CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {format(new Date(selectedRecording.date), 'MMMM d, yyyy')}
                                </p>
                            </CardHeader>
                            <CardContent className="p-0">
                                <WatermarkedPlayer recording={selectedRecording} />
                            </CardContent>
                        </Card>
                        <DoubtsSection recording={selectedRecording} />
                    </div>
                    <div className="lg:col-span-1">
                        <Card className="bg-white rounded-2xl shadow-lg sticky top-4">
                            <CardHeader><CardTitle>Other Lectures</CardTitle></CardHeader>
                            <CardContent>
                                <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                                    {filteredRecordings.filter(r => r.id !== selectedRecording.id).map(rec => (
                                        <div key={rec.id} className="p-4 border rounded-lg hover:shadow-md hover:border-primary/50 transition-all duration-200 cursor-pointer" onClick={() => handleSelectRecording(rec)}>
                                            <div className="flex items-center gap-3">
                                                <div className="bg-primary/10 p-2 rounded-full flex-shrink-0">
                                                    <PlayCircle className="h-5 w-5 text-primary" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-semibold text-primary line-clamp-1">{rec.topic}</p>
                                                    <p className="text-xs text-muted-foreground">{format(new Date(rec.date), 'MMM d, yyyy')}</p>
                                                </div>
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
        <div className="p-6 space-y-8 bg-gray-50/50 min-h-full">
            {/* Header Section */}
            <div>
                <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                    <PlayCircle className="mr-3 h-8 w-8 text-primary" />
                    Lectures
                </h1>
                <p className="text-gray-500 mt-1">Watch recorded classes for {subject}</p>
            </div>

            {/* Search Section - No filter dropdowns */}
            <div className="flex gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by topic..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-10"
                    />
                </div>
            </div>

            {/* Recordings Grid */}
            <div>
                {isLoading ? (
                    <RecordingSkeleton />
                ) : filteredRecordings.length > 0 ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filteredRecordings.map((recording) => (
                            <Card
                                key={recording.id}
                                className="bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group"
                                onClick={() => handleSelectRecording(recording)}
                            >
                                <div className="relative h-44 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                                    <PlayCircle className="h-16 w-16 text-white/30 group-hover:text-white/60 group-hover:scale-110 transition-all duration-300" />
                                    <div className="absolute top-3 right-3">
                                        <Badge variant="secondary" className="bg-white/90 text-slate-700 font-semibold text-xs">
                                            {format(new Date(recording.date), 'MMM d')}
                                        </Badge>
                                    </div>
                                </div>
                                <CardContent className="p-5">
                                    <h3 className="font-semibold text-gray-800 group-hover:text-primary transition-colors line-clamp-2">{recording.topic}</h3>
                                    <p className="text-sm text-muted-foreground mt-2">{format(new Date(recording.date), 'EEEE, MMMM d, yyyy')}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white rounded-lg border-dashed border-2 shadow-sm border-slate-300">
                        <div className="inline-block bg-slate-100 rounded-full p-4">
                            <PlayCircle className="h-12 w-12 text-slate-400" />
                        </div>
                        <h3 className="mt-6 text-xl font-semibold text-slate-700">No Lectures Found</h3>
                        <p className="text-muted-foreground mt-2">No recorded lectures are available for this subject yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};