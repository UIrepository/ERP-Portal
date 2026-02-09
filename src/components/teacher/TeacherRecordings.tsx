import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Play, Search, PlayCircle, Clock, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

// Fixed card dimensions for zoom stability (Matching Student Design)
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

export const TeacherRecordings = () => {
    const { user, profile } = useAuth();
    const queryClient = useQueryClient();
    
    // Filters State
    const [selectedBatch, setSelectedBatch] = useState<string>('all');
    const [selectedSubject, setSelectedSubject] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Player State
    const [isPlayerOpen, setIsPlayerOpen] = useState(false);
    const [selectedRecording, setSelectedRecording] = useState<RecordingContent | null>(null);
    const [playerLecture, setPlayerLecture] = useState<Lecture | null>(null);

    // 1. Fetch Teacher Profile for Assignments
    const { data: teacherInfo } = useQuery({
        queryKey: ['teacherInfo', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('teachers')
                .select('*')
                .eq('user_id', user?.id)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!user?.id
    });

    // 2. Fetch Recordings based on assignments
    const { data: recordings, isLoading } = useQuery({
        queryKey: ['teacherRecordings', teacherInfo?.assigned_batches, teacherInfo?.assigned_subjects],
        queryFn: async () => {
            if (!teacherInfo?.assigned_batches?.length || !teacherInfo?.assigned_subjects?.length) {
                return [];
            }
            const { data, error } = await supabase
                .from('recordings')
                .select('*')
                .in('batch', teacherInfo.assigned_batches)
                .in('subject', teacherInfo.assigned_subjects)
                .order('date', { ascending: false });
            
            if (error) throw error;
            return (data || []) as RecordingContent[];
        },
        enabled: !!teacherInfo
    });

    // 3. Filter Logic (Dropdowns + Search)
    const filteredRecordings = useMemo(() => {
        if (!recordings) return [];
        return recordings.filter(rec => {
            const matchesBatch = selectedBatch === 'all' || rec.batch === selectedBatch;
            const matchesSubject = selectedSubject === 'all' || rec.subject === selectedSubject;
            const matchesSearch = rec.topic.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesBatch && matchesSubject && matchesSearch;
        });
    }, [recordings, selectedBatch, selectedSubject, searchTerm]);

    const availableBatches = teacherInfo?.assigned_batches || [];
    const availableSubjects = teacherInfo?.assigned_subjects || [];

    // Transform database recording to player Lecture format
    const recordingToLecture = useCallback((rec: RecordingContent): Lecture => ({
        id: rec.id,
        title: rec.topic,
        subject: rec.subject,
        videoUrl: rec.embed_link,
        isCompleted: false,
    }), []);

    // All lectures for sidebar navigation in player
    const allLectures = useMemo(() => 
        filteredRecordings.map(rec => recordingToLecture(rec)),
        [filteredRecordings, recordingToLecture]
    );

    // 4. Fetch Doubts for the selected recording (Player Integration)
    const { data: playerDoubts = [] } = useQuery({
        queryKey: ['player-doubts', selectedRecording?.id],
        queryFn: async () => {
            if (!selectedRecording?.id) return [];
            
            // Fetch doubts
            const { data: doubtsData, error: doubtsError } = await supabase
                .from('doubts')
                .select(`id, question_text, created_at, user_id, profiles!inner(name)`)
                .eq('recording_id', selectedRecording.id)
                .order('created_at', { ascending: false });
            
            if (doubtsError) throw doubtsError;
            
            // Fetch answers
            const doubtIds = (doubtsData || []).map((d: any) => d.id);
            let answersData: any[] = [];
            
            if (doubtIds.length > 0) {
                const { data: answersResult } = await supabase
                    .from('doubt_answers')
                    .select(`id, answer_text, created_at, user_id, doubt_id, profiles!inner(name)`)
                    .in('doubt_id', doubtIds)
                    .order('created_at', { ascending: true });
                if (answersResult) answersData = answersResult;
            }
            
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

    // Handle Opening Player
    const handlePlayInFullscreen = useCallback((recording: RecordingContent) => {
        const lecture = recordingToLecture(recording);
        setPlayerLecture(lecture);
        setSelectedRecording(recording);
        setIsPlayerOpen(true);
    }, [recordingToLecture]);

    // Handle Switching Lecture inside Player
    const handleLectureChange = useCallback((lecture: Lecture) => {
        setPlayerLecture(lecture);
        const rec = recordings?.find(r => r.id === lecture.id);
        if (rec) setSelectedRecording(rec);
    }, [recordings]);

    // Handle Doubt Submission (Teachers can probably skip this, but keeping for compatibility)
    const handleDoubtSubmit = useCallback(async (question: string) => {
        if (!user || !selectedRecording) return;
        const { error } = await supabase.from('doubts').insert({
            recording_id: selectedRecording.id,
            user_id: user.id,
            question_text: question,
            batch: selectedRecording.batch,
            subject: selectedRecording.subject
        });
        if (error) {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: 'Note/Question posted.' });
            queryClient.invalidateQueries({ queryKey: ['player-doubts', selectedRecording.id] });
        }
    }, [user, selectedRecording, queryClient]);

    const clearFilters = () => {
        setSelectedBatch('all');
        setSelectedSubject('all');
        setSearchTerm('');
    };

    if (isPlayerOpen && playerLecture) {
        return (
            <FullScreenVideoPlayer
                currentLecture={playerLecture}
                lectures={allLectures}
                doubts={playerDoubts}
                onLectureChange={handleLectureChange}
                onDoubtSubmit={handleDoubtSubmit}
                onClose={() => setIsPlayerOpen(false)}
                userName={profile?.name || user?.email}
            />
        );
    }

    return (
        <div className="p-6 bg-slate-50 min-h-screen font-sans">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                
                {/* Header Section */}
                <div className="flex flex-col gap-6 mb-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                            My Recordings
                        </h1>
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

                    {/* Filters Row */}
                    <div className="flex flex-col md:flex-row gap-4 items-end md:items-center bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <div className="space-y-1.5 flex-1 w-full md:w-auto">
                            <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                <Filter className="h-3 w-3" /> Batch
                            </label>
                            <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                                <SelectTrigger className="bg-white h-9 border-slate-200">
                                    <SelectValue placeholder="All Batches" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Batches</SelectItem>
                                    {availableBatches.map((batch: string) => (
                                        <SelectItem key={batch} value={batch}>{batch}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5 flex-1 w-full md:w-auto">
                            <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                <Filter className="h-3 w-3" /> Subject
                            </label>
                            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                                <SelectTrigger className="bg-white h-9 border-slate-200">
                                    <SelectValue placeholder="All Subjects" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Subjects</SelectItem>
                                    {availableSubjects.map((subject: string) => (
                                        <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {(selectedBatch !== 'all' || selectedSubject !== 'all' || searchTerm) && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={clearFilters}
                                className="h-9 px-3 text-slate-500 hover:text-slate-900 hover:bg-slate-200"
                            >
                                <X className="h-4 w-4 mr-2" /> Clear
                            </Button>
                        )}
                    </div>
                </div>

                {/* Recordings Grid */}
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
                                        onClick={() => handlePlayInFullscreen(recording)}
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
                                        {/* Visual Banner */}
                                        <div 
                                            className="w-full bg-gradient-to-br from-white to-[#f0fdfa] rounded-lg relative flex items-center px-5 border border-[#ccfbf1] overflow-hidden group"
                                            style={{ height: BANNER_HEIGHT, minHeight: BANNER_HEIGHT, maxHeight: BANNER_HEIGHT, flexShrink: 0 }}
                                        >
                                            {/* Banner Title */}
                                            <div className="z-10 relative" style={{ flexShrink: 0 }}>
                                                <span className="text-[#0d9488] font-bold text-xl block tracking-tight whitespace-nowrap">
                                                    Lecture {lectureNo}
                                                </span>
                                                <span className="text-teal-600/70 text-xs font-medium uppercase tracking-wider mt-1 block">
                                                    {recording.batch}
                                                </span>
                                            </div>

                                            {/* Graphic Elements */}
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2" style={{ flexShrink: 0 }}>
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
                                                <div 
                                                    className="absolute bottom-0 right-0 bg-[#0d9488] rounded-full flex items-center justify-center text-white border-2 border-white shadow-sm z-20 group-hover:scale-110 transition-transform"
                                                    style={{ width: 36, height: 36, minWidth: 36, minHeight: 36, flexShrink: 0 }}
                                                >
                                                    <Play fill="white" className="w-3 h-3 ml-0.5" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Info Footer */}
                                        <div className="pt-3 px-1 pb-1 flex-1 flex flex-col justify-between overflow-hidden" style={{ minHeight: 0 }}>
                                            <div className="flex justify-between items-center mb-2 text-slate-500 font-normal text-xs" style={{ flexShrink: 0 }}>
                                                <span style={{ whiteSpace: 'nowrap' }}>{format(new Date(recording.date), 'dd MMM, yyyy')}</span>
                                                <div className="flex items-center gap-1" style={{ flexShrink: 0 }}>
                                                    <Clock className="opacity-70" style={{ width: 12, height: 12, flexShrink: 0 }} />
                                                    <span style={{ whiteSpace: 'nowrap' }}>{format(new Date(recording.created_at), 'h:mm a')}</span>
                                                </div>
                                            </div>
                                            <h2 className="text-base font-semibold text-slate-900 tracking-tight leading-snug line-clamp-2" style={{ flexShrink: 0 }} title={recording.topic}>
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
                            <h3 className="text-base font-semibold text-slate-900">No Recordings Found</h3>
                            <p className="text-sm text-slate-500">
                                {selectedBatch !== 'all' || selectedSubject !== 'all' 
                                    ? "Try adjusting your filters to see more results." 
                                    : "You haven't uploaded any recordings for your assigned batches yet."}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
