import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Video, Play, Search, ArrowLeft, PlayCircle, MessageSquare, Send, CornerDownRight, Clock, ChevronLeft } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { FullScreenVideoPlayer } from '@/components/video-player';
import { Lecture, Doubt as PlayerDoubt } from '@/components/video-player/types';

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

// Fixed card dimensions for zoom stability
const CARD_WIDTH = 280;
const CARD_HEIGHT = 280;
const BANNER_HEIGHT = 160;

// Skeletons
const RecordingSkeleton = () => (
    <div className="flex flex-wrap gap-5">
        {[...Array(8)].map((_, i) => (
            <div 
                key={i} 
                className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 animate-pulse flex flex-col"
                style={{ width: CARD_WIDTH, height: CARD_HEIGHT, flexShrink: 0 }}
            >
                <div className="bg-slate-100 rounded-lg w-full" style={{ height: BANNER_HEIGHT, flexShrink: 0 }} />
                <div className="space-y-2 px-1 pt-3 flex-1">
                    <div className="flex justify-between">
                        <div className="h-3 bg-slate-100 rounded w-20" />
                        <div className="h-3 bg-slate-100 rounded w-12" />
                    </div>
                    <div className="h-4 bg-slate-100 rounded w-3/4" />
                </div>
            </div>
        ))}
    </div>
);

// Player Component (legacy embedded player - kept for detail view)
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


// Main Component
export const StudentRecordings = ({ batch, subject }: StudentRecordingsProps) => {
    const { user, profile } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRecording, setSelectedRecording] = useState<RecordingContent | null>(null);
    const isMobile = useIsMobile();
    
    // Fullscreen player state
    const [isPlayerOpen, setIsPlayerOpen] = useState(false);
    const [playerLecture, setPlayerLecture] = useState<Lecture | null>(null);

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

    // Transform database recording to player Lecture format
    const recordingToLecture = useCallback((rec: RecordingContent, index: number): Lecture => ({
        id: rec.id,
        title: rec.topic,
        subject: rec.subject,
        videoUrl: rec.embed_link,
        isCompleted: false,
    }), []);

    // All lectures for the sidebar navigation
    const allLectures = useMemo(() => 
        filteredRecordings.map((rec, idx) => recordingToLecture(rec, idx)),
        [filteredRecordings, recordingToLecture]
    );

    // Query doubts for the selected recording (for fullscreen player)
    const { data: playerDoubts = [] } = useQuery({
        queryKey: ['player-doubts', selectedRecording?.id],
        queryFn: async () => {
            if (!selectedRecording?.id) return [];
            
            // Fetch doubts with profiles
            const { data: doubtsData, error: doubtsError } = await supabase
                .from('doubts')
                .select(`id, question_text, created_at, user_id, profiles!inner(name)`)
                .eq('recording_id', selectedRecording.id)
                .order('created_at', { ascending: false });
            
            if (doubtsError) throw doubtsError;
            
            // Fetch answers for these doubts
            const doubtIds = (doubtsData || []).map((d: any) => d.id);
            let answersData: any[] = [];
            
            if (doubtIds.length > 0) {
                const { data: answersResult, error: answersError } = await supabase
                    .from('doubt_answers')
                    .select(`id, answer_text, created_at, user_id, doubt_id, profiles!inner(name)`)
                    .in('doubt_id', doubtIds)
                    .order('created_at', { ascending: true });
                
                if (!answersError) {
                    answersData = answersResult || [];
                }
            }
            
            // Transform to PlayerDoubt format
            return (doubtsData || []).map((doubt: any): PlayerDoubt => {
                const answer = answersData.find((a: any) => a.doubt_id === doubt.id);
                return {
                    id: doubt.id,
                    question: doubt.question_text,
                    askedBy: doubt.profiles?.name || 'A student',
                    askedAt: new Date(doubt.created_at),
                    answer: answer?.answer_text,
                    answeredBy: answer?.profiles?.name,
                    answeredAt: answer ? new Date(answer.created_at) : undefined,
                };
            });
        },
        enabled: !!selectedRecording?.id && isPlayerOpen,
    });

    const logActivity = async (activityType: string, description: string, metadata?: any) => {
        if (!profile?.user_id) return;
        await supabase.from('student_activities').insert({
            user_id: profile.user_id, activity_type: activityType, description, metadata,
            batch: batch || null,
            subject: subject || null,
        });
    };

    // Handle opening the fullscreen player
    const handlePlayInFullscreen = useCallback(async (recording: RecordingContent, index: number) => {
        const lecture = recordingToLecture(recording, index);
        setPlayerLecture(lecture);
        setSelectedRecording(recording);
        setIsPlayerOpen(true);
        
        await logActivity('recording_view', `Opened fullscreen: ${recording.topic}`, {
            recordingId: recording.id, 
            topic: recording.topic,
            playMode: 'fullscreen'
        });
    }, [recordingToLecture, logActivity]);

    // Handle lecture change from within the player
    const handleLectureChange = useCallback((lecture: Lecture) => {
        setPlayerLecture(lecture);
        const rec = recordings?.find(r => r.id === lecture.id);
        if (rec) {
            setSelectedRecording(rec);
            logActivity('recording_view', `Switched to: ${rec.topic}`, {
                recordingId: rec.id,
                topic: rec.topic,
                playMode: 'fullscreen'
            });
        }
    }, [recordings, logActivity]);

    // Handle doubt submission from the player
    const handleDoubtSubmit = useCallback(async (question: string) => {
        if (!user || !selectedRecording) return;
        
        const { error } = await supabase.from('doubts').insert({
            recording_id: selectedRecording.id,
            user_id: user.id,
            question_text: question,
            batch: batch || selectedRecording.batch,
            subject: subject || selectedRecording.subject
        });
        
        if (error) {
            toast({ 
                title: 'Error posting question', 
                description: error.message, 
                variant: 'destructive' 
            });
        } else {
            toast({ 
                title: 'Success', 
                description: 'Your question has been posted.' 
            });
            // Refresh doubts
            queryClient.invalidateQueries({ queryKey: ['player-doubts', selectedRecording.id] });
        }
    }, [user, selectedRecording, batch, subject, queryClient]);

    // Handle closing the player
    const handleClosePlayer = useCallback(() => {
        setIsPlayerOpen(false);
    }, []);

    // Legacy detail view handler (kept for backwards compatibility)
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

    // Render fullscreen player when open
    if (isPlayerOpen && playerLecture) {
        return (
            <FullScreenVideoPlayer
                currentLecture={playerLecture}
                lectures={allLectures}
                doubts={playerDoubts}
                onLectureChange={handleLectureChange}
                onDoubtSubmit={handleDoubtSubmit}
                onClose={handleClosePlayer}
                userName={profile?.name || user?.email}
            />
        );
    }

    if (selectedRecording) {
        return (
            <div className="p-4 space-y-4 bg-white min-h-full font-sans">
                <Button variant="outline" size="sm" onClick={() => setSelectedRecording(null)} className="mb-2 bg-white hover:bg-slate-50 text-slate-600 border-slate-200">
                    <ArrowLeft className="h-3.5 w-3.5 mr-2" /> Back to Lectures
                </Button>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div className="lg:col-span-2">
                        <Card className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200">
                            <CardHeader className="p-4 border-b border-slate-100">
                                <CardTitle className="text-base font-semibold text-slate-800">{selectedRecording.topic}</CardTitle>
                                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-normal">
                                    <Clock className="h-3.5 w-3.5" />
                                    {format(new Date(selectedRecording.date), 'MMMM d, yyyy')} • {format(new Date(selectedRecording.created_at), 'h:mm a')}
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
                        <Card className="bg-white rounded-xl shadow-sm border border-slate-200 sticky top-4">
                            <CardHeader className="pb-2 pt-4 px-4"><CardTitle className="text-base text-slate-800">Other Lectures</CardTitle></CardHeader>
                            <CardContent className="px-4 pb-4">
                                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                                    {filteredRecordings.filter(r => r.id !== selectedRecording.id).map((rec, idx) => (
                                        <div 
                                            key={rec.id} 
                                            className="group flex gap-3 p-2 hover:bg-slate-50 rounded-md cursor-pointer transition-colors border border-transparent hover:border-slate-100" 
                                            onClick={() => handleSelectRecording(rec)}
                                        >
                                            <div className="relative w-20 h-12 bg-slate-100 rounded overflow-hidden flex-shrink-0">
                                                 {/* Mini Thumbnail */}
                                                <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                                                    <PlayCircle className="h-5 w-5 text-white/70" />
                                                </div>
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                <p className="font-medium text-xs text-slate-800 line-clamp-2 group-hover:text-teal-600 transition-colors">
                                                    {rec.topic}
                                                </p>
                                                <p className="text-[10px] text-slate-400 mt-0.5 font-normal">
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
        <div className="p-6 bg-white min-h-full font-sans">
            {/* Unified White Section for Header + Content */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                            Class Lectures
                        </h1>
                    </div>
                    
                    {/* Search */}
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <Input
                            placeholder="Search topics..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-9 text-sm bg-white border-slate-200 focus:border-teal-500 focus:ring-teal-500"
                        />
                    </div>
                </div>

                {/* Recordings Grid - Zoom-stable layout with fixed card dimensions */}
                <div>
                    {isLoading ? (
                        <RecordingSkeleton />
                    ) : filteredRecordings.length > 0 ? (
                        <div className="flex flex-wrap gap-5">
                            {filteredRecordings.map((recording, index) => {
                                const lectureNo = filteredRecordings.length - index; 
                                
                                return (
                                    <div 
                                        key={recording.id}
                                        onClick={() => handlePlayInFullscreen(recording, index)}
                                        className={cn(
                                            "bg-white rounded-lg p-3",
                                            "shadow-[0_1px_3px_rgba(0,0,0,0.05)]",
                                            "border border-slate-200",
                                            "cursor-pointer",
                                            "flex flex-col",
                                            "hover:shadow-md hover:border-teal-200 transition-all duration-200"
                                        )}
                                        style={{
                                            width: CARD_WIDTH,
                                            height: CARD_HEIGHT,
                                            minWidth: CARD_WIDTH,
                                            maxWidth: CARD_WIDTH,
                                            minHeight: CARD_HEIGHT,
                                            maxHeight: CARD_HEIGHT,
                                            flexShrink: 0,
                                            flexGrow: 0,
                                        }}
                                    >
                                        {/* Visual Banner - Fixed Height */}
                                        <div 
                                            className="w-full bg-gradient-to-br from-white to-[#f0fdfa] rounded-lg relative flex items-center px-5 border border-[#ccfbf1] overflow-hidden"
                                            style={{ height: BANNER_HEIGHT, minHeight: BANNER_HEIGHT, maxHeight: BANNER_HEIGHT, flexShrink: 0 }}
                                        >
                                            {/* Banner Title - Lecture No */}
                                            <div className="z-10 relative" style={{ flexShrink: 0 }}>
                                                <span className="text-[#0d9488] font-bold text-xl block tracking-tight whitespace-nowrap">
                                                    Lecture {lectureNo}
                                                </span>
                                            </div>

                                            {/* Graphic Elements (Right) - Fixed Position */}
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2" style={{ flexShrink: 0 }}>
                                                {/* Logo Circle - Fixed Size */}
                                                <div 
                                                    className="bg-[#111] rounded-full flex items-center justify-center border-4 border-[#f0fdfa] shadow-sm select-none overflow-hidden p-2"
                                                    style={{ width: 100, height: 100, minWidth: 100, minHeight: 100, flexShrink: 0 }}
                                                >
                                                    <img 
                                                        src="https://res.cloudinary.com/dkywjijpv/image/upload/v1769193106/UI_Logo_yiput4.png" 
                                                        alt="UI Logo" 
                                                        className="w-full h-full object-contain"
                                                    />
                                                </div>
                                                {/* Play Button Overlay - Fixed Size */}
                                                <div 
                                                    className="absolute bottom-0 right-0 bg-[#0d9488] rounded-full flex items-center justify-center text-white border-2 border-white shadow-sm z-20"
                                                    style={{ width: 36, height: 36, minWidth: 36, minHeight: 36, flexShrink: 0 }}
                                                >
                                                    <Play fill="white" className="w-3 h-3 ml-0.5" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Info Footer - Fixed layout */}
                                        <div className="pt-3 px-1 pb-1 flex-1 flex flex-col justify-between overflow-hidden" style={{ minHeight: 0 }}>
                                            <div className="flex justify-between items-center mb-2 text-slate-500 font-normal text-xs" style={{ flexShrink: 0 }}>
                                                <span style={{ whiteSpace: 'nowrap' }}>{format(new Date(recording.date), 'dd MMM, yyyy')}</span>
                                                <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                                                    <Clock className="opacity-70" style={{ width: 12, height: 12, flexShrink: 0 }} />
                                                    <span style={{ whiteSpace: 'nowrap' }}>{format(new Date(recording.created_at), 'h:mm a')}</span>
                                                </div>
                                            </div>
                                            {/* Topic Title */}
                                            <h2 className="text-base font-semibold text-slate-900 tracking-tight leading-snug line-clamp-2" style={{ flexShrink: 0 }}>
                                                {recording.topic}
                                            </h2>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-16 bg-white rounded-lg border border-dashed border-slate-300">
                            <div className="inline-block bg-slate-50 rounded-full p-3 mb-3">
                                <PlayCircle className="h-8 w-8 text-slate-400" />
                            </div>
                            <h3 className="text-base font-semibold text-slate-900">No Class Lectures Found</h3>
                            <p className="text-sm text-slate-500">No recorded lectures are available for this subject.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
