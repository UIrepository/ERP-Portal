import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

const ScheduleSkeleton = () => (
    <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
            <Card key={i}>
                <CardHeader>
                    <Skeleton className="h-6 w-1/4" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </CardContent>
            </Card>
        ))}
    </div>
);

export const ScheduleManagement = () => {
  const [activeTab, setActiveTab] = useState('regular');
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedDay, setSelectedDay] = useState('all');

  const { data: schedules = [], isLoading: isLoadingSchedules } = useQuery({
    queryKey: ['admin-schedules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('schedules').select('*').order('day_of_week, start_time');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: profiles = [], isLoading: isLoadingProfiles } = useQuery({
    queryKey: ['all-profiles-for-filters'],
    queryFn: async () => {
        const { data, error } = await supabase.from('profiles').select('batch');
        if (error) throw error;
        return data || [];
    }
  });

  const batchOptions = useMemo(() => {
    const batches = new Set<string>();
    profiles.forEach(p => {
        const userBatches = Array.isArray(p.batch) ? p.batch : [p.batch];
        userBatches.forEach(b => {
            if(b) batches.add(b);
        });
    });
    return Array.from(batches).sort();
  }, [profiles]);

  const dayOptions = [
    { value: 'all', label: 'All Days' },
    { value: '1', label: 'Monday' },
    { value: '2', label: 'Tuesday' },
    { value: '3', label: 'Wednesday' },
    { value: '4', label: 'Thursday' },
    { value: '5', label: 'Friday' },
    { value: '6', label: 'Saturday' },
    { value: '0', label: 'Sunday' }
  ];

  const filteredSchedules = schedules.filter(s => 
    (selectedBatch === 'all' || s.batch === selectedBatch) &&
    (selectedDay === 'all' || s.day_of_week.toString() === selectedDay)
  );
  
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return format(date, 'h:mm a');
  };

  const isLoading = isLoadingSchedules || isLoadingProfiles;

  return (
    <div className="p-6 space-y-8 bg-gray-50/50 min-h-full">
        {/* Header Section */}
        <div>
            <h1 className="text-3xl font-bold text-gray-800">Schedules Overview</h1>
            <p className="text-gray-500 mt-1">View all class schedules across different batches.</p>
        </div>

        {/* Filter Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select value={selectedBatch} onValueChange={setSelectedBatch}>
            <SelectTrigger>
                <SelectValue placeholder="Filter by Batch" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Batches</SelectItem>
                {batchOptions.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
            </Select>
            <Select value={selectedDay} onValueChange={setSelectedDay}>
            <SelectTrigger>
                <SelectValue placeholder="Filter by Day" />
            </SelectTrigger>
            <SelectContent>
                {dayOptions.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
            </Select>
        </div>

        {/* Schedules List */}
        {isLoading ? (
            <ScheduleSkeleton />
        ) : filteredSchedules.length > 0 ? (
            <Card className="bg-white">
                <CardContent className="p-6">
                    <div className="space-y-4">
                        {filteredSchedules.map((schedule) => (
                            <div key={schedule.id} className="p-4 border rounded-lg flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-gray-800">{schedule.subject}</p>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                        <Clock className="h-4 w-4" />
                                        <span>{formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <Badge variant="secondary">{schedule.batch}</Badge>
                                    <p className="text-sm text-muted-foreground mt-1">{dayOptions.find(d => d.value === schedule.day_of_week.toString())?.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        ) : (
            <div className="text-center py-20 bg-white rounded-lg border-dashed border-2">
                <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700">No Schedules Found</h3>
                <p className="text-muted-foreground mt-2">There are no schedules matching your current filters.</p>
            </div>
        )}
    </div>
  );
};
