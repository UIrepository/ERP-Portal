import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { GitMerge, Unlink, Plus, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface SubjectMerge {
  id: string;
  primary_batch: string;
  primary_subject: string;
  secondary_batch: string;
  secondary_subject: string;
  is_active: boolean;
  created_at: string;
}

interface EnrollmentPair {
  batch_name: string;
  subject_name: string;
}

export const AdminSubjectMerges = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [primaryBatch, setPrimaryBatch] = useState('');
  const [primarySubject, setPrimarySubject] = useState('');
  const [secondaryBatch, setSecondaryBatch] = useState('');
  const [secondarySubject, setSecondarySubject] = useState('');

  // Fetch distinct batch-subject pairs from user_enrollments
  const { data: enrollments = [] } = useQuery<EnrollmentPair[]>({
    queryKey: ['enrollment-pairs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_enrollments')
        .select('batch_name, subject_name')
        .order('batch_name');
      if (error) throw error;
      // Deduplicate
      const seen = new Set<string>();
      return (data || []).filter(e => {
        const key = `${e.batch_name}|${e.subject_name}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
  });

  const batches = [...new Set(enrollments.map(e => e.batch_name))].sort();
  const primarySubjects = primaryBatch
    ? [...new Set(enrollments.filter(e => e.batch_name === primaryBatch).map(e => e.subject_name))].sort()
    : [];
  const secondarySubjects = secondaryBatch
    ? [...new Set(enrollments.filter(e => e.batch_name === secondaryBatch).map(e => e.subject_name))].sort()
    : [];

  const handlePrimaryBatchChange = (val: string) => {
    setPrimaryBatch(val);
    setPrimarySubject('');
  };
  const handleSecondaryBatchChange = (val: string) => {
    setSecondaryBatch(val);
    setSecondarySubject('');
  };

  // Fetch active merges
  const { data: merges = [], isLoading } = useQuery<SubjectMerge[]>({
    queryKey: ['subject-merges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subject_merges')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as SubjectMerge[];
    },
  });

  // Create merge mutation
  const createMerge = useMutation({
    mutationFn: async () => {
      if (!primaryBatch || !primarySubject || !secondaryBatch || !secondarySubject) {
        throw new Error('Please select all fields');
      }
      if (primaryBatch === secondaryBatch && primarySubject === secondarySubject) {
        throw new Error('Cannot merge a subject with itself');
      }

      // Check for existing active merge
      const { data: existing } = await supabase
        .from('subject_merges')
        .select('id')
        .eq('is_active', true)
        .or(
          `and(primary_batch.eq.${primaryBatch},primary_subject.eq.${primarySubject},secondary_batch.eq.${secondaryBatch},secondary_subject.eq.${secondarySubject}),` +
          `and(primary_batch.eq.${secondaryBatch},primary_subject.eq.${secondarySubject},secondary_batch.eq.${primaryBatch},secondary_subject.eq.${primarySubject})`
        );

      if (existing && existing.length > 0) {
        throw new Error('This merge already exists');
      }

      const { error } = await supabase.from('subject_merges').insert({
        primary_batch: primaryBatch,
        primary_subject: primarySubject,
        secondary_batch: secondaryBatch,
        secondary_subject: secondarySubject,
        created_by: profile?.user_id,
      } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Merge Created', description: 'Subjects have been merged successfully.' });
      queryClient.invalidateQueries({ queryKey: ['subject-merges'] });
      setPrimaryBatch('');
      setPrimarySubject('');
      setSecondaryBatch('');
      setSecondarySubject('');
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // De-merge mutation
  const demerge = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('subject_merges')
        .update({ is_active: false } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'De-merged', description: 'Subjects have been de-merged successfully.' });
      queryClient.invalidateQueries({ queryKey: ['subject-merges'] });
      // Also invalidate merge caches so students see the change
      queryClient.invalidateQueries({ queryKey: ['merged-subjects'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Subject Merges</h1>
        <p className="text-sm text-slate-500 mt-1">
          Merge subjects across batches to share recordings, notes, community, and schedules.
        </p>
      </div>

      {/* Create Merge Form */}
      <Card className="border-slate-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Merge
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row items-start lg:items-end gap-4">
            {/* Primary Side */}
            <div className="flex-1 space-y-2 w-full">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Side A</label>
              <div className="flex gap-2">
                <Select value={primaryBatch} onValueChange={handlePrimaryBatchChange}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select Batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={primarySubject} onValueChange={setPrimarySubject}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select Subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {primarySubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="hidden lg:flex items-center justify-center px-2 pb-1">
              <ArrowRight className="h-5 w-5 text-slate-400" />
            </div>

            {/* Secondary Side */}
            <div className="flex-1 space-y-2 w-full">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Side B</label>
              <div className="flex gap-2">
                <Select value={secondaryBatch} onValueChange={handleSecondaryBatchChange}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select Batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={secondarySubject} onValueChange={setSecondarySubject}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select Subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {secondarySubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={() => createMerge.mutate()}
              disabled={createMerge.isPending || !primaryBatch || !primarySubject || !secondaryBatch || !secondarySubject}
              className="whitespace-nowrap"
            >
              <GitMerge className="h-4 w-4 mr-2" />
              {createMerge.isPending ? 'Merging...' : 'Merge'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Merges */}
      <Card className="border-slate-200">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Active Merges
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : merges.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <GitMerge className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No active merges</p>
              <p className="text-xs mt-1">Create a merge above to combine subjects across batches.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {merges.map(merge => (
                <div
                  key={merge.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {merge.primary_batch} / {merge.primary_subject}
                    </Badge>
                    <GitMerge className="h-4 w-4 text-slate-400" />
                    <Badge variant="outline" className="font-mono text-xs">
                      {merge.secondary_batch} / {merge.secondary_subject}
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => demerge.mutate(merge.id)}
                    disabled={demerge.isPending}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                  >
                    <Unlink className="h-3.5 w-3.5 mr-1.5" />
                    De-merge
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
