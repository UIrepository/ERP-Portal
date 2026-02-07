import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Play, Search, PlayCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
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



// Main Component
export const StudentRecordings = ({ batch, subject }: StudentRecordingsProps) => {
    const { user, profile } = useAuth();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRecording, setSelectedRecording] = useState<RecordingContent | null>(null);
    
    
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
