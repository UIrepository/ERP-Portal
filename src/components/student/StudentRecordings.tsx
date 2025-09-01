import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Video, Play, Search, ArrowLeft, PlayCircle, Home, Calendar, Book, User, Menu, Bell, MessageSquare, Send } from 'lucide-react';
import { format } from 'date-fns';
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

interface UserEnrollment {
    batch_name: string;
    subject_name: string;
}

interface Profile {
    name: string;
}

interface Doubt {
    id: string;
    question_text: string;
    created_at: string;
    profiles: Profile;
}

interface DoubtAnswer {
    id: string;
    answer_text: string;
    created_at: string;
    profiles: Profile;
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
const DoubtsSection = ({ recordingId }: { recordingId: string }) => {
    const { profile } = useAuth();
    const queryClient = useQueryClient();
    const [newDoubt, setNewDoubt] = useState('');
    const [newAnswers, setNewAnswers] = useState<Record<string, string>>({});

    const { data: doubts = [], isLoading: isLoadingDoubts } = useQuery<Doubt[]>({
        queryKey: ['doubts', recordingId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('doubts')
                .select(`*, profiles(name)`)
                .eq('recording_id', recordingId)
                .order('created_at', { ascending: true });
            if (error) throw error;
            return data as Doubt[];
        },
        enabled: !!recordingId,
    });

    const { data: answers = [], isLoading: isLoadingAnswers } = useQuery<DoubtAnswer[]>({
        queryKey: ['doubt_answers', doubts.map(d => d.id)],
        queryFn: async () => {
            if (doubts.length === 0) return [];
            const doubtIds = doubts.map(d => d.id);
            const { data, error } = await supabase
                .from('doubt_answers')
                .select(`*, doubt_id, profiles(name)`)
                .in('doubt_id', doubtIds)
                .order('created_at', { ascending: true });
            if (error) throw error;
            return data as DoubtAnswer[];
        },
        enabled: doubts.length > 0,
    });
    
    const answersByDoubtId = useMemo(() => {
        const map = new Map<string, DoubtAnswer[]>();
        answers.forEach(answer => {
            const existing = map.get(answer.doubt_id) || [];
            map.set(answer.doubt_id, [...existing, answer]);
        });
        return map;
    }, [answers]);

    const addDoubtMutation = useMutation({
        mutationFn: async (question_text: string) => {
            const { error } = await supabase.from('doubts').insert({ recording_id: recordingId, user_id: profile?.user_id, question_text });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['doubts', recordingId] });
            setNewDoubt('');
            toast({ title: 'Success', description: 'Your question has been posted.' });
        },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    const addAnswerMutation = useMutation({
        mutationFn: async ({ doubt_id, answer_text }: { doubt_id: string, answer_text: string }) => {
            const { error } = await supabase.from('doubt_answers').insert({ doubt_id, user_id: profile?.user_id, answer_text });
            if (error) throw error;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['doubt_answers', doubts.map(d => d.id)] });
            setNewAnswers(prev => ({ ...prev, [variables.doubt_id]: '' }));
            toast({ title: 'Success', description: 'Your answer has been posted.' });
        },
        onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
    });

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MessageSquare /> Doubts & Discussions
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <Textarea placeholder="Ask a question about this recording..." value={newDoubt} onChange={e => setNewDoubt(e.target.value)} />
                    <Button onClick={() => addDoubtMutation.mutate(newDoubt)} disabled={!newDoubt.trim() || addDoubtMutation.isPending}>
                        <Send className="mr-2 h-4 w-4" /> Ask Question
                    </Button>
                </div>
                <div className="mt-6 space-y-4">
                    {isLoadingDoubts ? <p>Loading doubts...</p> : (
                        <Accordion type="single" collapsible className="w-full">
                            {doubts.map(doubt => (
                                <AccordionItem key={doubt.id} value={doubt.id}>
                                    <AccordionTrigger>
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6">
                                                <AvatarFallback>{doubt.profiles.name.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <span className="font-semibold">{doubt.profiles.name}</span>
                                            <span className="font-normal text-left flex-1 pl-2">{doubt.question_text}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pl-8">
                                        {answersByDoubtId.get(doubt.id)?.map(answer => (
                                            <div key={answer.id} className="py-2 border-b">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarFallback>{answer.profiles.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-semibold">{answer.profiles.name}</span>
                                                    <span className="text-gray-500">{format(new Date(answer.created_at), 'PPP')}</span>
                                                </div>
                                                <p className="pt-2 pl-8">{answer.answer_text}</p>
                                            </div>
                                        ))}
                                        <div className="mt-4 space-y-2">
                                            <Textarea placeholder="Write an answer..." value={newAnswers[doubt.id] || ''} onChange={e => setNewAnswers(prev => ({...prev, [doubt.id]: e.target.value}))} />
                                            <Button size="sm" onClick={() => addAnswerMutation.mutate({ doubt_id: doubt.id, answer_text: newAnswers[doubt.id] })} disabled={!newAnswers[doubt.id] || addAnswerMutation.isPending}>Reply</Button>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};


export const StudentRecordings = () => {
    const { profile } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');
    const [selectedBatchFilter, setSelectedBatchFilter] = useState('all');
    const [selectedRecording, setSelectedRecording] = useState<RecordingContent | null>(null);
    const isMobile = useIsMobile();

    const { data: userEnrollments, isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
        queryKey: ['userEnrollments', profile?.user_id],
        queryFn: async () => {
            if (!profile?.user_id) return [];
            const { data, error } = await supabase.from('user_enrollments').select('batch_name, subject_name').eq('user_id', profile.user_id);
            if (error) {
                console.error("Error fetching user enrollments:", error);
                return [];
            }
            return data || [];
        },
        enabled: !!profile?.user_id
    });

    const displayedBatches = useMemo(() => {
        if (!userEnrollments) return [];
        if (selectedSubjectFilter === 'all') return Array.from(new Set(userEnrollments.map(e => e.batch_name))).sort();
        return Array.from(new Set(userEnrollments.filter(e => e.subject_name === selectedSubjectFilter).map(e => e.batch_name))).sort();
    }, [userEnrollments, selectedSubjectFilter]);

    const displayedSubjects = useMemo(() => {
        if (!userEnrollments) return [];
        if (selectedBatchFilter !== 'all') return Array.from(new Set(userEnrollments.filter(e => e.batch_name === selectedBatchFilter).map(e => e.subject_name))).sort();
        return Array.from(new Set(userEnrollments.map(e => e.subject_name))).sort();
    }, [userEnrollments, selectedBatchFilter]);

    useEffect(() => {
        if (selectedBatchFilter !== 'all' && !displayedBatches.includes(selectedBatchFilter)) setSelectedBatchFilter('all');
    }, [selectedBatchFilter, displayedBatches]);

    useEffect(() => {
        if (selectedSubjectFilter !== 'all' && !displayedSubjects.includes(selectedSubjectFilter)) setSelectedSubjectFilter('all');
    }, [selectedSubjectFilter, displayedSubjects]);

    const { data: recordings, isLoading: isLoadingRecordingsContent } = useQuery<RecordingContent[]>({
        queryKey: ['student-recordings', userEnrollments, selectedBatchFilter, selectedSubjectFilter],
        queryFn: async (): Promise<RecordingContent[]> => {
            if (!userEnrollments || userEnrollments.length === 0) return [];
            let query = supabase.from('recordings').select('*');
            const combinationFilters = userEnrollments
                .filter(e => (selectedBatchFilter === 'all' || e.batch_name === selectedBatchFilter) && (selectedSubjectFilter === 'all' || e.subject_name === selectedSubjectFilter))
                .map(e => `and(batch.eq.${e.batch_name},subject.eq.${e.subject_name})`);
            if (combinationFilters.length > 0) query = query.or(combinationFilters.join(','));
            else return [];
            const { data, error } = await query.order('date', { ascending: false });
            if (error) throw error;
            return (data || []) as RecordingContent[];
        },
        enabled: !!userEnrollments && userEnrollments.length > 0
    });

    const filteredRecordings = useMemo(() => recordings?.filter(rec =>
        rec.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rec.subject.toLowerCase().includes(searchTerm.toLowerCase())
    ), [recordings, searchTerm]);

    const isLoading = isLoadingEnrollments || isLoadingRecordingsContent;

    if (selectedRecording) {
        const upNextRecordings = recordings?.filter(rec => rec.id !== selectedRecording.id && rec.batch === selectedRecording.batch && rec.subject === selectedRecording.subject).slice(0, 10) || [];
        return (
            <div className="p-4 md:p-6 space-y-6 bg-slate-100 min-h-full">
                <Button variant="outline" onClick={() => setSelectedRecording(null)} className="mb-4">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Recordings
                </Button>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card className="bg-black rounded-2xl overflow-hidden shadow-2xl">
                            <CardContent className="p-0">
                                <WatermarkedPlayer recording={selectedRecording} />
                            </CardContent>
                        </Card>
                        <div className="mt-6">
                            <h1 className="text-2xl font-bold text-slate-800">{selectedRecording.topic}</h1>
                            <div className="flex items-center gap-4 text-slate-500 mt-2">
                                <span>{format(new Date(selectedRecording.date), 'PPP')}</span>
                                <Badge variant="secondary">{selectedRecording.batch}</Badge>
                                <Badge variant="outline">{selectedRecording.subject}</Badge>
                            </div>
                        </div>
                        <DoubtsSection recordingId={selectedRecording.id} />
                    </div>
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-slate-700">Up Next</h2>
                        {upNextRecordings.map(rec => (
                            <Card key={rec.id} className="p-3 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setSelectedRecording(rec)}>
                                <div className="flex gap-4 items-center">
                                    <div className="w-24 h-16 bg-slate-200 rounded-md flex-shrink-0 relative">
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                            <Play className="h-6 w-6 text-white" />
                                        </div>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm line-clamp-2">{rec.topic}</p>
                                        <p className="text-xs text-slate-500">{rec.subject}</p>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    if (isMobile) {
        return (
            <div className="min-h-screen bg-gray-50 text-gray-800 pb-20">
                <header className="bg-white shadow-sm p-4 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        <Menu className="text-indigo-600" />
                        <h1 className="text-xl font-bold text-gray-900">Class Recordings</h1>
                    </div>
                    <div className="flex items-center space-x-4">
                        <Bell className="text-gray-500" />
                        <img alt="User avatar" className="w-8 h-8 rounded-full" src={`https://ui-avatars.com/api/?name=${profile?.name}&background=random`} />
                    </div>
                </header>
                <main className="p-4">
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Welcome back!</h2>
                        <p className="text-gray-500 text-sm">Review past lectures and catch up on missed classes.</p>
                    </div>
                    <div className="relative mb-6">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                        <Input className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Search recordings..." type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="space-y-4">
                        {isLoading ? <RecordingSkeleton /> : (
                            filteredRecordings && filteredRecordings.length > 0 ? (
                                filteredRecordings.map((recording) => (
                                    <div key={recording.id} onClick={() => setSelectedRecording(recording)} className="bg-white rounded-xl shadow-sm overflow-hidden cursor-pointer">
                                        <div className="relative">
                                            <div className="w-full h-40 bg-gray-800 flex items-center justify-center">
                                                <button className="w-14 h-14 bg-white bg-opacity-30 rounded-full flex items-center justify-center backdrop-blur-sm">
                                                    <Play className="text-white h-8 w-8 fill-white" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-4">
                                            <h3 className="font-semibold text-gray-900 text-lg">{recording.topic}</h3>
                                            <p className="text-sm text-gray-500 mb-3">{format(new Date(recording.date), 'PPP')}</p>
                                            <div className="flex items-center space-x-2">
                                                <span className="inline-block bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">{recording.subject}</span>
                                                <span className="inline-block bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">{recording.batch}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-20">
                                    <Video className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-xl font-semibold text-gray-700">No Recordings Found</h3>
                                    <p className="text-muted-foreground mt-2">Check back later or adjust your filters.</p>
                                </div>
                            )
                        )}
                    </div>
                </main>
                <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2">
                    <a className="flex flex-col items-center text-gray-500 hover:text-indigo-600" href="#">
                        <Home />
                        <span className="text-xs">Home</span>
                    </a>
                    <a className="flex flex-col items-center text-indigo-600" href="#">
                        <PlayCircle />
                        <span className="text-xs">Recordings</span>
                    </a>
                    <a className="flex flex-col items-center text-gray-500 hover:text-indigo-600" href="#">
                        <Calendar />
                        <span className="text-xs">Schedule</span>
                    </a>
                    <a className="flex flex-col items-center text-gray-500 hover:text-indigo-600" href="#">
                        <Book />
                        <span className="text-xs">Notes</span>
                    </a>
                    <a className="flex flex-col items-center text-gray-500 hover:text-indigo-600" href="#">
                        <User />
                        <span className="text-xs">Profile</span>
                    </a>
                </nav>
            </div>
        )
    }

    return (
        <main className="flex-1 flex flex-col bg-slate-50">
            <header className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                        <Video className="h-6 w-6 mr-3 text-indigo-600" />
                        Class Recordings
                    </h1>
                    <p className="text-gray-500 mt-1">Review past lectures and catch up on missed classes.</p>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Search recordings..."
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div>
                        <Select value={selectedBatchFilter} onValueChange={setSelectedBatchFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="All Batches" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Batches</SelectItem>
                                {displayedBatches.map((batch) => (
                                    <SelectItem key={batch} value={batch}>{batch}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Select value={selectedSubjectFilter} onValueChange={setSelectedSubjectFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="All Subjects" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Subjects</SelectItem>
                                {displayedSubjects.map((subject) => (
                                    <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </header>
            <div className="flex-1 p-8 overflow-y-auto">
                {isLoading ? <RecordingSkeleton /> : (
                    filteredRecordings && filteredRecordings.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                            {filteredRecordings.map((recording) => (
                                <div key={recording.id} onClick={() => setSelectedRecording(recording)} className="bg-white rounded-xl shadow-lg overflow-hidden transform hover:-translate-y-1 transition-transform duration-300 cursor-pointer">
                                    <div className="relative">
                                        <div className="bg-gray-800 h-48 flex items-center justify-center">
                                            <PlayCircle className="text-white text-6xl opacity-80" />
                                        </div>
                                    </div>
                                    <div className="p-5">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">{recording.topic}</h3>
                                        <p className="text-sm text-gray-500 mb-4">{format(new Date(recording.date), 'PPP')}</p>
                                        <div className="flex items-center space-x-2">
                                            <span className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-0.5 rounded-full">{recording.subject}</span>
                                            <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">{recording.batch}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <Video className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-gray-700">No Recordings Found</h3>
                            <p className="text-muted-foreground mt-2">Check back later or adjust your filters.</p>
                        </div>
                    )
                )}
            </div>
        </main>
    );
};
