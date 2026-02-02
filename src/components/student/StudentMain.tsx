import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [isBatchSwitcherOpen, setIsBatchSwitcherOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
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

  // Update URL when navigation changes
  const updateUrl = useCallback((nav: NavigationState) => {
    const params = new URLSearchParams();
    if (nav.batch) params.set('batch', nav.batch);
    if (nav.subject) params.set('subject', nav.subject);
    if (nav.block) params.set('block', nav.block);
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  // Read URL params on mount and when enrollments load
  useEffect(() => {
    if (!userEnrollments || userEnrollments.length === 0 || isInitialized) return;
    
    const batchParam = searchParams.get('batch');
    const subjectParam = searchParams.get('subject');
    const blockParam = searchParams.get('block');
    
    // Validate batch exists in enrollments
    const validBatch = batchParam && availableBatches.includes(batchParam) 
      ? batchParam 
      : availableBatches[0] || null;
    
    // Validate subject exists for the batch
    const subjectsForBatch = userEnrollments
      .filter(e => e.batch_name === validBatch)
      .map(e => e.subject_name);
    const validSubject = subjectParam && subjectsForBatch.includes(subjectParam) 
      ? subjectParam 
      : null;
    
    // Determine level
    let level: NavigationLevel = 'batch';
    if (blockParam && validSubject) {
      level = 'block';
    } else if (validSubject) {
      level = 'subject';
    }
    
    const newNav: NavigationState = {
      level,
      batch: validBatch,
      subject: validSubject,
      block: blockParam || null,
    };
    
    setNavigation(newNav);
    updateUrl(newNav);
    setIsInitialized(true);
  }, [userEnrollments, availableBatches, searchParams, isInitialized, updateUrl]);

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

  // Navigation handlers with URL sync
  const handleSelectBatch = (batch: string) => {
    const newNav: NavigationState = {
      level: 'batch',
      batch,
      subject: null,
      block: null,
    };
    setNavigation(newNav);
    updateUrl(newNav);
  };

  const handleSelectSubject = (subject: string) => {
    const newNav: NavigationState = {
      ...navigation,
      level: 'subject',
      subject,
      block: null,
    };
    setNavigation(newNav);
    updateUrl(newNav);
  };

  const handleSelectBlock = (block: string) => {
    const newNav: NavigationState = {
      ...navigation,
      level: 'block',
      block,
    };
    setNavigation(newNav);
    updateUrl(newNav);
  };

  const handleBackToSubjects = () => {
    const newNav: NavigationState = {
      ...navigation,
      level: 'batch',
      subject: null,
      block: null,
    };
    setNavigation(newNav);
    updateUrl(newNav);
  };

  const handleBackToBlocks = () => {
    const newNav: NavigationState = {
      ...navigation,
      level: 'subject',
      block: null,
    };
    setNavigation(newNav);
    updateUrl(newNav);
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
