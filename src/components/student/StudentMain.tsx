import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { StudentSubjectCard } from './StudentSubjectCard';
import { StudentSubjectBlocks } from './StudentSubjectBlocks';
import { StudentBlockContent } from './StudentBlockContent';
import { StudentAnnouncements } from './StudentAnnouncements';
import { StudentCommunity } from './StudentCommunity';
import { StudentConnect } from './StudentConnect';
import { StudentSchedule } from './StudentSchedule';
import { Skeleton } from '@/components/ui/skeleton';
import { Share2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserEnrollment {
  batch_name: string;
  subject_name: string;
}

type NavigationLevel = 'batch' | 'subject' | 'block';
type TabType = 'classes' | 'live' | 'announcements' | 'community' | 'connect';

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
  const [activeTab, setActiveTab] = useState<TabType>('classes');
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

  // Navigation handlers
  const handleSelectBatch = (batch: string) => {
    const newNav: NavigationState = {
      level: 'batch',
      batch,
      subject: null,
      block: null,
    };
    setNavigation(newNav);
    updateUrl(newNav);
    setActiveTab('classes'); // Reset to classes tab on batch change
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

  // --- Main Batch Level View (New Design) ---
  
  const renderTabContent = () => {
    switch (activeTab) {
      case 'classes':
        return (
          <main className="bg-white rounded-[16px] p-[35px] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]">
            <div className="mb-[30px]">
              <h2 className="text-[22px] font-bold text-[#1e293b] mb-1">Subjects</h2>
              <p className="text-[14px] text-[#64748b]">Select your subjects & start learning</p>
            </div>

            {isLoadingEnrollments ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[20px]">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-[14px]" />
                ))}
              </div>
            ) : subjectsForBatch.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[20px]">
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
              <div className="text-center py-20">
                <p className="text-[#64748b]">No subjects found for this batch.</p>
              </div>
            )}
          </main>
        );
      case 'live':
        return (
          <div className="bg-white rounded-[16px] p-[20px] shadow-sm">
             <StudentSchedule />
          </div>
        );
      case 'announcements':
        return (
          <div className="bg-white rounded-[16px] p-[20px] shadow-sm">
            <StudentAnnouncements />
          </div>
        );
      case 'community':
        return (
          <div className="bg-white rounded-[16px] p-[20px] shadow-sm">
            <StudentCommunity />
          </div>
        );
      case 'connect':
        return (
           <div className="bg-white rounded-[16px] p-[20px] shadow-sm">
            <StudentConnect />
           </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-[1100px] mx-auto p-6 flex flex-col items-center min-h-screen bg-[#f1f5f9]">
      {/* Header Section */}
      <header className="w-full bg-white rounded-[16px] overflow-hidden shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] mb-[25px]">
        {/* Top Banner with Gradient */}
        <div className="relative bg-gradient-to-br from-[#0f172a] to-[#1e293b] px-[35px] py-[45px] text-white">
          {/* Subtle geometric pattern overlay */}
          <div 
            className="absolute top-0 right-0 w-[300px] h-full bg-[rgba(13,148,136,0.15)] z-0"
            style={{ clipPath: 'polygon(100% 0, 0% 100%, 100% 100%)' }}
          />
          
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-[28px] font-bold tracking-tight">
                {navigation.batch || "No Batch Selected"}
              </h1>
              {availableBatches.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white hover:bg-white/10">
                      <ChevronDown className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {availableBatches.map((b) => (
                      <DropdownMenuItem key={b} onClick={() => handleSelectBatch(b)}>
                        {b}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-[35px] border-b border-[#e2e8f0]">
          <nav className="flex gap-[30px] overflow-x-auto w-full sm:w-auto no-scrollbar">
            {[
              { id: 'classes', label: 'All Classes' },
              { id: 'live', label: 'Join Live Class' },
              { id: 'announcements', label: 'Announcements' },
              { id: 'community', label: 'Community' },
              { id: 'connect', label: 'Support Connect' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  "py-[20px] text-[14px] font-medium transition-colors relative whitespace-nowrap",
                  activeTab === tab.id 
                    ? "text-[#0d9488]" 
                    : "text-[#64748b] hover:text-[#1e293b]"
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 w-full h-[3px] bg-[#0d9488] rounded-t-[10px]" />
                )}
              </button>
            ))}
          </nav>

          <button className="hidden sm:flex items-center gap-2 px-[18px] py-[9px] my-4 sm:my-0 border border-[#e2e8f0] rounded-[10px] bg-white text-[14px] font-medium text-[#1e293b] hover:bg-[#f8fafc] transition-colors">
            <Share2 className="h-4 w-4" />
            Share Batch
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="w-full">
        {renderTabContent()}
      </div>
    </div>
  );
};
