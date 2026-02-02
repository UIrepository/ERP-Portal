import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { StudentBatchHeader } from './StudentBatchHeader';
import { StudentBatchSwitcher } from './StudentBatchSwitcher';
import { StudentSubjectCard } from './StudentSubjectCard';
import { StudentSubjectBlocks } from './StudentSubjectBlocks';
import { StudentBlockContent } from './StudentBlockContent';
import { StudentQuickActions } from './StudentQuickActions';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen } from 'lucide-react';

interface UserEnrollment {
  batch_name: string;
  subject_name: string;
}

type NavigationLevel = 'batch' | 'subject' | 'block';

interface NavigationState {
  level: NavigationLevel;
  batch: string | null;
  subject: string | null;
  block: string | null;
}

export const StudentMain = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isBatchSwitcherOpen, setIsBatchSwitcherOpen] = useState(false);
  
  const [navigation, setNavigation] = useState<NavigationState>({
    level: 'batch',
    batch: null,
    subject: null,
    block: null,
  });

  // Fetch user enrollments
  const { data: userEnrollments, isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
    queryKey: ['studentMainEnrollments', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      const { data, error } = await supabase
        .from('user_enrollments')
        .select('batch_name, subject_name')
        .eq('user_id', profile.user_id);
      if (error) return [];
      return data || [];
    },
    enabled: !!profile?.user_id,
  });

  // Derive available batches
  const availableBatches = useMemo(() => {
    return Array.from(new Set(userEnrollments?.map((e) => e.batch_name) || [])).sort();
  }, [userEnrollments]);

  // Set initial batch when data loads
  useEffect(() => {
    if (availableBatches.length > 0 && !navigation.batch) {
      setNavigation((prev) => ({
        ...prev,
        batch: availableBatches[0],
      }));
    }
  }, [availableBatches, navigation.batch]);

  // Derive subjects for selected batch
  const subjectsForBatch = useMemo(() => {
    if (!navigation.batch || !userEnrollments) return [];
    return Array.from(
      new Set(
        userEnrollments
          .filter((e) => e.batch_name === navigation.batch)
          .map((e) => e.subject_name)
      )
    ).sort();
  }, [userEnrollments, navigation.batch]);

  // Real-time sync for enrollments
  useEffect(() => {
    if (!profile?.user_id) return;
    const channel = supabase
      .channel('student-main-enrollments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_enrollments',
          filter: `user_id=eq.${profile.user_id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['studentMainEnrollments'] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.user_id, queryClient]);

  // Navigation handlers
  const handleSelectBatch = (batch: string) => {
    setNavigation({
      level: 'batch',
      batch,
      subject: null,
      block: null,
    });
  };

  const handleSelectSubject = (subject: string) => {
    setNavigation((prev) => ({
      ...prev,
      level: 'subject',
      subject,
      block: null,
    }));
  };

  const handleSelectBlock = (block: string) => {
    setNavigation((prev) => ({
      ...prev,
      level: 'block',
      block,
    }));
  };

  const handleBackToSubjects = () => {
    setNavigation((prev) => ({
      ...prev,
      level: 'batch',
      subject: null,
      block: null,
    }));
  };

  const handleBackToBlocks = () => {
    setNavigation((prev) => ({
      ...prev,
      level: 'subject',
      block: null,
    }));
  };

  // Render block content view
  if (navigation.level === 'block' && navigation.batch && navigation.subject && navigation.block) {
    return (
      <StudentBlockContent
        blockId={navigation.block}
        batch={navigation.batch}
        subject={navigation.subject}
        onBack={handleBackToBlocks}
      />
    );
  }

  // Render subject blocks view
  if (navigation.level === 'subject' && navigation.batch && navigation.subject) {
    return (
      <StudentSubjectBlocks
        batch={navigation.batch}
        subject={navigation.subject}
        onBack={handleBackToSubjects}
        onBlockSelect={handleSelectBlock}
      />
    );
  }

  // Render main batch/subjects view
  return (
    <div className="min-h-full bg-slate-50">
      <StudentBatchHeader
        selectedBatch={navigation.batch}
        batchCount={availableBatches.length}
        onOpenBatchSwitcher={() => setIsBatchSwitcherOpen(true)}
      />

      <StudentBatchSwitcher
        isOpen={isBatchSwitcherOpen}
        onClose={() => setIsBatchSwitcherOpen(false)}
        batches={availableBatches}
        selectedBatch={navigation.batch}
        onSelectBatch={handleSelectBatch}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Actions */}
        <StudentQuickActions batch={navigation.batch} subjects={subjectsForBatch} />

        {/* Subjects Section */}
        <div className="mt-10">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">
            Your Subjects
          </h2>

          {isLoadingEnrollments ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : subjectsForBatch.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjectsForBatch.map((subject, index) => (
                <StudentSubjectCard
                  key={subject}
                  subject={subject}
                  index={index}
                  onClick={() => handleSelectSubject(subject)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
              <BookOpen className="h-16 w-16 text-slate-300 mb-4" />
              <h3 className="text-xl font-semibold text-slate-700">No Subjects Found</h3>
              <p className="text-slate-500 mt-2 text-center max-w-sm">
                You don't have any subjects enrolled in this batch yet. Please contact admin for assistance.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
