import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, getDay, startOfWeek, addDays, isSameDay, subDays, parseISO, isWithinInterval } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, Video, Plus, Loader2, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

// --- Interfaces ---

interface Schedule {
  id: string;
  subject: string;
  batch: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  date?: string;
  link?: string;
}

interface Exam {
  id: string;
  name: string;
  date: string;
  subject: string;
  batch: string;
  type: string;
}

// --- Constants ---

const subjectBorderColors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-indigo-500',
    'bg-lime-500',
    'bg-teal-500',
    'bg-fuchsia-500',
];

const ScheduleSkeleton = () => (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="grid grid-cols-[80px_repeat(7,1fr)] min-w-[800px]">
             <div className="h-14 bg-gray-50 border-b border-r border-gray-200" />
             {[...Array(7)].map((_, i) => (
                 <div key={i} className="h-14 border-b border-r border-gray-200 bg-gray-50 p-4">
                     <Skeleton className="h-4 w-8 mx-auto" />
                 </div>
             ))}
             {[...Array(5)].map((_, r) => (
                 <>
                    <div key={`time-${r}`} className="h-32 border-b border-r border-gray-200 p-4">
                        <Skeleton className="h-4 w-12 ml-auto" />
                    </div>
                    {[...Array(7)].map((_, c) => (
                        <div key={`cell-${r}-${c}`} className="h-32 border-b border-r border-gray-200 p-2">
                             {Math.random() > 0.7 && <Skeleton className="h-20 w-full rounded-md" />}
                        </div>
                    ))}
                 </>
             ))}
        </div>
    </div>
);

// --- Internal Add Class Component (Merged) ---

function AddClassForm({ 
  assignedBatches, 
  assignedSubjects, 
  onSuccess 
}: { 
  assignedBatches: string[], 
  assignedSubjects: string[], 
  onSuccess: () => void 
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const [newClass, setNewClass] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '',
    end_time: '',
    subject: '',
    batch: ''
  });

  const addClassMutation = useMutation({
    mutationFn: async () => {
      if (!newClass.batch || !newClass.subject || !newClass.date || !newClass.start_time || !newClass.end_time) {
          throw new Error("Please fill in all required fields.");
      }

      const dateObj = parseISO(newClass.date);
      const dayOfWeek = getDay(dateObj); // 0 = Sunday

      let cleanSubject = newClass.subject.trim();
      const batchSuffix = `(${newClass.batch})`;
      if (cleanSubject.includes(batchSuffix)) {
          cleanSubject = cleanSubject.replace(batchSuffix, '').trim();
      }

      const { error } = await supabase.from('schedules').insert({
          day_of_week: dayOfWeek,
          date: newClass.date,
          start_time: newClass.start_time,
          end_time: newClass.end_time,
          subject: cleanSubject,
          batch: newClass.batch,
          link: null 
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Class added successfully!");
      setOpen(false);
      setNewClass({
          date: format(new Date(), 'yyyy-MM-dd'),
          start_time: '',
          end_time: '',
          subject: '',
          batch: ''
      });
      queryClient.invalidateQueries({ queryKey: ['teacher-all-schedules'] });
      onSuccess();
    },
    onError: (error) => {
      toast.error(`Failed to add class: ${error.message}`);
    }
  });

  const FormContent = (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="batch" className="text-right">Batch</Label>
          <Select 
              value={newClass.batch} 
              onValueChange={(val) => setNewClass({...newClass, batch: val})}
          >
              <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select batch" />
              </SelectTrigger>
              <SelectContent>
                  {assignedBatches.length > 0 ? (
                    assignedBatches.map((batch) => (
                      <SelectItem key={batch} value={batch}>{batch}</SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>No batches assigned</SelectItem>
                  )}
              </SelectContent>
          </Select>
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="subject" className="text-right">Subject</Label>
          <Select 
              value={newClass.subject} 
              onValueChange={(val) => setNewClass({...newClass, subject: val})}
          >
              <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                  {assignedSubjects.length > 0 ? (
                    assignedSubjects.map((subj) => (
                      <SelectItem key={subj} value={subj}>{subj}</SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>No subjects assigned</SelectItem>
                  )}
              </SelectContent>
          </Select>
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="date" className="text-right">Date</Label>
          <Input
              id="date"
              type="date"
              value={newClass.date}
              onChange={(e) => setNewClass({...newClass, date: e.target.value})}
              className="col-span-3"
          />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="start" className="text-right">Start</Label>
          <Input
              id="start"
              type="time"
              value={newClass.start_time}
              onChange={(e) => setNewClass({...newClass, start_time: e.target.value})}
              className="col-span-3"
          />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="end" className="text-right">End</Label>
          <Input
              id="end"
              type="time"
              value={newClass.end_time}
              onChange={(e) => setNewClass({...newClass, end_time: e.target.value})}
              className="col-span-3"
          />
      </div>
    </div>
  );

  const FooterContent = (
    <Button onClick={() => addClassMutation.mutate()} disabled={addClassMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto">
        {addClassMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Schedule Class
    </Button>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-none">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Add Class
          </Button>
        </SheetTrigger>
        <SheetContent side="top">
          <SheetHeader>
            <SheetTitle>Add Extra Class</SheetTitle>
          </SheetHeader>
          {FormContent}
          <SheetFooter>
            {FooterContent}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white border-none shadow-none">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Class
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Extra Class</DialogTitle>
        </DialogHeader>
        {FormContent}
        <DialogFooter>
          {FooterContent}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Main Component ---

export const TeacherSchedule = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // State
  const [currentTime, setCurrentTime] = useState(new Date());
  const [displayDate, setDisplayDate] = useState(new Date());
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');

  // --- Real-time Clock ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Real-time Subscription ---
  useEffect(() => {
    const channel = supabase
      .channel('teacher-realtime-schedules-and-exams')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, () => {
          queryClient.invalidateQueries({ queryKey: ['teacher-all-schedules'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exams' }, () => {
          queryClient.invalidateQueries({ queryKey: ['teacher-all-exams'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // --- Data Fetching ---

  // 1. Fetch Teacher Info
  const { data: teacherInfo } = useQuery({
    queryKey: ['teacherInfo', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('teachers')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const availableBatches = useMemo(() => {
    return teacherInfo?.assigned_batches?.sort() || [];
  }, [teacherInfo]);

  // 2. Fetch Schedules
  const { data: schedules, isLoading: isLoadingSchedules } = useQuery<Schedule[]>({
    queryKey: ['teacher-all-schedules', selectedBatchFilter],
    queryFn: async (): Promise<Schedule[]> => {
        let query = supabase.from('schedules').select('*');
        if (selectedBatchFilter !== 'all') {
            query = query.eq('batch', selectedBatchFilter);
        }
        const { data, error } = await query
            .order('date', { nullsFirst: false })
            .order('day_of_week')
            .order('start_time');
        if (error) throw error;
        return data || [];
    },
  });

  // 3. Fetch Exams
  const { data: exams, isLoading: isLoadingExams } = useQuery<Exam[]>({
    queryKey: ['teacher-all-exams', selectedBatchFilter],
    queryFn: async (): Promise<Exam[]> => {
        let query = supabase.from('exams').select('*');
        if (selectedBatchFilter !== 'all') {
            query = query.eq('batch', selectedBatchFilter);
        }
        const { data, error } = await query.order('date');
        if (error) throw error;
        return data || [];
    },
  });

  const isLoading = isLoadingSchedules || isLoadingExams;

  // --- Logic & Helpers ---

  const weekDates = useMemo(() => {
    const start = startOfWeek(displayDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
  }, [displayDate]);

  const timeSlots = useMemo(() => {
    if (!schedules) return [];
    const slots = new Set<string>();
    schedules.forEach(s => slots.add(s.start_time));
    return Array.from(slots).sort();
  }, [schedules]);

  const subjectColorMap = useMemo(() => {
    const allSubjects = new Set<string>();
    if (schedules) schedules.forEach(s => allSubjects.add(s.subject));
    if (exams) exams.forEach(e => allSubjects.add(e.subject));

    const uniqueSubjects = Array.from(allSubjects).sort();
    const colorMap = new Map<string, string>();
    uniqueSubjects.forEach((subject, index) => {
        colorMap.set(subject, subjectBorderColors[index % subjectBorderColors.length]);
    });
    return colorMap;
  }, [schedules, exams]);

  const getSubjectBorderColor = (subject: string) => {
    return subjectColorMap.get(subject) || 'bg-gray-400';
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  const isClassLive = (schedule: Schedule, classDate: Date) => {
    if (!isSameDay(classDate, currentTime)) return false;

    const [startH, startM] = schedule.start_time.split(':').map(Number);
    const [endH, endM] = schedule.end_time.split(':').map(Number);
    
    const startTime = new Date(currentTime);
    startTime.setHours(startH, startM, 0);
    
    const endTime = new Date(currentTime);
    endTime.setHours(endH, endM, 0);

    return isWithinInterval(currentTime, { start: startTime, end: endTime });
  };

  const handlePreviousWeek = () => setDisplayDate(subDays(displayDate, 7));
  const handleNextWeek = () => setDisplayDate(addDays(displayDate, 7));

  return (
    <div className="p-4 sm:p-8 bg-white min-h-screen font-sans text-slate-900 max-w-7xl mx-auto">
      
      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Teacher Schedule</h1>
          <p className="text-sm text-slate-500 font-medium">{format(displayDate, 'MMMM yyyy')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-gray-50/80 p-1.5 rounded-lg border border-gray-200 shadow-sm w-full md:w-auto">
          
          {/* Add Class Button (Responsive Drawer/Dialog) */}
          <AddClassForm 
            assignedBatches={teacherInfo?.assigned_batches || []} 
            assignedSubjects={teacherInfo?.assigned_subjects || []}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['teacher-all-schedules'] })}
          />

          <div className="h-5 w-px bg-gray-300 mx-1 hidden sm:block"></div>

          {/* Batch Filter */}
          <Select value={selectedBatchFilter} onValueChange={setSelectedBatchFilter}>
            <SelectTrigger className="h-8 w-[160px] border-none bg-transparent shadow-none focus:ring-0 text-xs font-semibold text-slate-700">
              <SelectValue placeholder="All Batches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Batches</SelectItem>
              {availableBatches.map((batch) => (
                <SelectItem key={batch} value={batch}>{batch}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="h-5 w-px bg-gray-300 mx-1 hidden sm:block"></div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-slate-900 hover:bg-white" onClick={handlePreviousWeek}>
                  <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-semibold text-slate-700 min-w-[100px] text-center tabular-nums">
                  {format(weekDates[0], 'd MMM')} — {format(weekDates[6], 'd MMM')}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-slate-900 hover:bg-white" onClick={handleNextWeek}>
                  <ChevronRight className="h-4 w-4" />
              </Button>
          </div>

          <div className="h-5 w-px bg-gray-300 mx-1 hidden sm:block"></div>

          {/* Real-time Timer */}
          <div className="px-2 flex items-center gap-2 text-slate-600 bg-white border border-gray-200 rounded-md h-7 shadow-sm">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs font-mono font-medium tabular-nums tracking-wide">
                {format(currentTime, 'HH:mm:ss')}
            </span>
          </div>
        </div>
      </header>

      {/* CALENDAR GRID */}
      {isLoading ? <ScheduleSkeleton /> : (
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm overflow-x-auto relative">
          <div className="grid min-w-[900px] grid-cols-[80px_repeat(7,1fr)] bg-slate-50">
            
            {/* Header Row */}
            <div className="p-4 border-b border-r border-gray-200 bg-gray-50/50 sticky left-0 z-20"></div>
            {weekDates.map((date, index) => {
                const isToday = isSameDay(date, currentTime);
                return (
                    <div key={index} className={cn(
                        "p-3 text-center border-b border-r border-gray-200 last:border-r-0 transition-colors",
                        isToday ? "bg-white" : "bg-gray-50/50"
                    )}>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{format(date, 'EEE')}</div>
                        <div className={cn(
                            "text-lg font-medium",
                            isToday ? "text-indigo-600" : "text-slate-700"
                        )}>{format(date, 'dd')}</div>
                    </div>
                );
            })}

            {/* Time Slots Rows */}
            {timeSlots.map((time, timeIndex) => (
                <>
                    {/* Time Label */}
                    <div key={`time-${time}`} className="sticky left-0 z-10 bg-white p-3 text-right text-[11px] font-medium text-slate-400 border-r border-b border-gray-200 flex flex-col justify-start pt-6">
                        {formatTime(time)}
                    </div>

                    {/* Day Cells for this Time Slot */}
                    {weekDates.map((date, dayIndex) => {
                        const dayNum = getDay(date);
                        
                        // Filter classes
                        const cellClasses = schedules?.filter(s => {
                            const isTimeMatch = s.start_time === time;
                            const isRecurring = !s.date && s.day_of_week === dayNum;
                            const isDateSpecific = s.date && isSameDay(new Date(s.date), date);
                            return isTimeMatch && (isRecurring || isDateSpecific);
                        }) || [];

                        // Filter exams (first slot of the day only)
                        const cellExams = (timeIndex === 0) 
                            ? exams?.filter(e => isSameDay(new Date(e.date), date)) || []
                            : [];

                        return (
                            <div key={`cell-${dayIndex}-${timeIndex}`} className="p-2 border-r border-b border-gray-200 last:border-r-0 bg-white min-h-[120px] hover:bg-slate-50/30 transition-colors relative">
                                
                                {/* EXAMS */}
                                {cellExams.map(exam => (
                                    <div 
                                        key={exam.id} 
                                        className="relative bg-rose-50 border border-rose-200 rounded-md p-2 mb-2 shadow-sm"
                                    >
                                        <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-sm bg-rose-500" />
                                        <div className="pl-2">
                                            <div className="flex items-center gap-1 mb-1">
                                                <BookOpen className="h-3 w-3 text-rose-500" />
                                                <h3 className="text-xs font-semibold text-rose-900 truncate">{exam.name}</h3>
                                            </div>
                                            <div className="text-[10px] text-rose-700">
                                                <span className="font-medium">{exam.subject}</span> • {exam.batch}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {/* CLASSES */}
                                {cellClasses.map(classInfo => {
                                    const isLive = isClassLive(classInfo, date);
                                    
                                    return (
                                        <div 
                                          key={classInfo.id} 
                                          className={cn(
                                            "relative bg-white border rounded-md p-3 mb-2 shadow-sm transition-all group overflow-hidden",
                                            isLive ? "border-indigo-200 shadow-md ring-1 ring-indigo-50" : "border-gray-200 hover:border-gray-300"
                                          )}
                                        >
                                            <div className={cn("absolute left-0 top-3 bottom-3 w-[3px] rounded-r-sm", getSubjectBorderColor(classInfo.subject))} />

                                            <div className="pl-3">
                                                <div className="flex items-center justify-between mb-1">
                                                    <h3 className="text-xs font-semibold text-slate-900 truncate pr-2 flex items-center">
                                                        {isLive && (
                                                            <span className="relative flex h-2 w-2 mr-2">
                                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                            </span>
                                                        )}
                                                        {classInfo.subject}
                                                    </h3>
                                                </div>
                                                
                                                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-2">
                                                    <span>{classInfo.batch}</span>
                                                    <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-[2px] text-[9px] font-medium text-slate-600">
                                                        {formatTime(classInfo.end_time)}
                                                    </span>
                                                </div>

                                                {/* Teacher Action: Join or View */}
                                                {classInfo.link ? (
                                                    <Button 
                                                        size="sm" 
                                                        variant={isLive ? "default" : "outline"}
                                                        className={cn(
                                                            "w-full h-7 text-[10px] font-medium",
                                                            isLive ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "text-slate-600 border-slate-200 hover:bg-slate-50"
                                                        )}
                                                        asChild
                                                    >
                                                        <a href={classInfo.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5">
                                                            {isLive ? <Video className="h-3 w-3" /> : null}
                                                            {isLive ? "Join Live" : "Join Class"}
                                                        </a>
                                                    </Button>
                                                ) : (
                                                    <div className="h-7 flex items-center justify-center text-[10px] text-slate-400 italic bg-slate-50 rounded border border-slate-100">
                                                        No Link
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </>
            ))}
            
            {/* Empty State */}
            {timeSlots.length === 0 && (
                <div className="col-span-8 py-16 flex flex-col items-center justify-center text-slate-400">
                    <p className="text-sm">No classes scheduled for this week.</p>
                </div>
            )}
          </div>
      </div>
      )}
    </div>
  );
};
