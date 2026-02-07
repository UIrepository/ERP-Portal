import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { StudentSubjectCard } from './StudentSubjectCard';
import { StudentSubjectBlocks } from './StudentSubjectBlocks';
import { StudentBlockContent } from './StudentBlockContent';
import { StudentAnnouncements } from './StudentAnnouncements';
import { StudentConnect } from './StudentConnect';
import { StudentLiveClass } from './StudentLiveClass';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRightLeft } from 'lucide-react'; 
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useChatDrawer } from '@/hooks/useChatDrawer';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

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

const StudentMainContent = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('classes');
  const [isInitialized, setIsInitialized] = useState(false);
  const { openSupportDrawer } = useChatDrawer();
  
  const [navigation, setNavigation] = useState<NavigationState>({
    level: 'batch',
    batch: null,
    subject: null,
    block: null,
  });

  // Batch Switcher State
  const [isBatchSheetOpen, setIsBatchSheetOpen] = useState(false);
  const [tempSelectedBatch, setTempSelectedBatch] = useState<string | null>(null);

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

  // Initialize navigation from URL
  useEffect(() => {
    if (!userEnrollments || userEnrollments.length === 0 || isInitialized) return;
    
    const batchParam = searchParams.get('batch');
    const subjectParam = searchParams.get('subject');
    const blockParam = searchParams.get('block');
    
    const validBatch = batchParam && availableBatches.includes(batchParam) 
      ? batchParam 
      : availableBatches[0] || null;
    
    const subjectsForBatch = userEnrollments
      .filter(e => e.batch_name === validBatch)
      .map(e => e.subject_name);
    const validSubject = subjectParam && subjectsForBatch.includes(subjectParam) 
      ? subjectParam 
      : null;
    
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

  // Initialize temp batch selection when sheet opens
  useEffect(() => {
    if (isBatchSheetOpen && navigation.batch) {
      setTempSelectedBatch(navigation.batch);
    }
  }, [isBatchSheetOpen, navigation.batch]);

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

  // Real-time sync
  useEffect(() => {
    if (!profile?.user_id) return;
    const channel = supabase
      .channel('student-main-enrollments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_enrollments', filter: `user_id=eq.${profile.user_id}` }, () => {
          queryClient.invalidateQueries({ queryKey: ['studentMainEnrollments'] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.user_id, queryClient]);

  // Navigation handlers
  const handleSelectBatch = (batch: string) => {
    const newNav: NavigationState = { level: 'batch', batch, subject: null, block: null };
    setNavigation(newNav);
    updateUrl(newNav);
    setActiveTab('classes');
  };

  const confirmBatchSwitch = () => {
    if (tempSelectedBatch) {
      handleSelectBatch(tempSelectedBatch);
      setIsBatchSheetOpen(false);
    }
  };

  const handleSelectSubject = (subject: string) => {
    const newNav: NavigationState = { ...navigation, level: 'subject', subject, block: null };
    setNavigation(newNav);
    updateUrl(newNav);
  };

  const handleSelectBlock = (block: string) => {
    if (block === 'community') {
      window.open('/portal/student/community', '_blank');
      return;
    }
    const newNav: NavigationState = { ...navigation, level: 'block', block };
    setNavigation(newNav);
    updateUrl(newNav);
  };

  const handleBackToSubjects = () => {
    const newNav: NavigationState = { ...navigation, level: 'batch', subject: null, block: null };
    setNavigation(newNav);
    updateUrl(newNav);
  };

  const handleBackToBlocks = () => {
    const newNav: NavigationState = { ...navigation, level: 'subject', block: null };
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

  // --- Main Batch Level View ---
  const renderTabContent = () => {
    switch (activeTab) {
      case 'classes':
        return (
          <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[#1e293b] mb-0.5">Subjects</h2>
              <p className="text-[13px] text-[#64748b]">Select your subjects & start learning</p>
            </div>

            {isLoadingEnrollments ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))}
              </div>
            ) : subjectsForBatch.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
              <div className="text-center py-16 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                <p className="text-[#64748b] text-sm">No subjects found for this batch.</p>
              </div>
            )}
          </div>
        );
      case 'live':
        return (
          <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
             <StudentLiveClass batch={navigation.batch} />
          </div>
        );
      case 'announcements':
        return (
          <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {navigation.batch && (
                <StudentAnnouncements 
                    batch={navigation.batch} 
                    enrolledSubjects={subjectsForBatch}
                />
            )}
          </div>
        );
      case 'community':
        return null;
        case 'connect':
          return (
             <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <StudentConnect onOpenSupportDrawer={openSupportDrawer} />
             </div>
          );
      default:
        return null;
    }
  };

  const handleTabClick = (tabId: string) => {
    if (tabId === 'community') {
      window.open('/portal/student/community', '_blank');
    } else {
      setActiveTab(tabId as TabType);
    }
  };

  return (
    // Outer Container
    <div className="w-full max-w-[1600px] mx-auto px-4 md:px-6 py-6 flex flex-col gap-6 min-h-screen font-sans">
      
      {/* HEADER SECTION */}
      <header className="w-full rounded-t-lg rounded-b-none overflow-hidden shadow-sm border border-indigo-100/50 relative z-10 group">
        
        {/* Banner */}
        <div className="relative bg-gradient-to-br from-violet-100 via-indigo-50 to-purple-100 px-6 py-8 text-slate-900">
          
          {/* Dot Pattern Overlay */}
          <div className="absolute inset-0 z-0 opacity-[0.3]" 
               style={{ backgroundImage: 'radial-gradient(#8b5cf6 0.5px, transparent 0.5px)', backgroundSize: '12px 12px' }}>
          </div>

          {/* Decorative Blur Accent */}
          <div 
            className="absolute top-0 right-0 w-[400px] h-full bg-indigo-200/20 blur-3xl z-0 pointer-events-none"
            style={{ clipPath: 'polygon(100% 0, 0% 100%, 100% 100%)' }}
          />
          
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Title - Arrow REMOVED */}
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {navigation.batch || "No Batch Selected"}
              </h1>
            </div>

            {/* SWITCH BATCH BUTTON */}
            {availableBatches.length > 1 && (
                <Sheet open={isBatchSheetOpen} onOpenChange={setIsBatchSheetOpen}>
                  <SheetTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="bg-white/80 backdrop-blur-sm border-indigo-200 text-indigo-700 hover:bg-white hover:text-indigo-800 shadow-sm gap-2 font-medium"
                    >
                      Switch Batch
                      <ArrowRightLeft className="h-4 w-4 opacity-70" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:w-[400px] flex flex-col p-0 z-[100]">
                     <div className="p-6 border-b border-slate-100 mt-6 sm:mt-0">
                        <h2 className="text-xl font-bold text-slate-900">Switch</h2>
                        <p className="text-sm text-slate-500 mt-1">Select the batch you want to switch to.</p>
                     </div>
                     
                     <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {availableBatches.map((b) => (
                            <div 
                                key={b}
                                onClick={() => setTempSelectedBatch(b)}
                                className={cn(
                                    "p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between",
                                    tempSelectedBatch === b 
                                        ? "border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-600/20" 
                                        : "border-slate-200 hover:border-indigo-200 hover:bg-slate-50"
                                )}
                            >
                                <span className={cn(
                                    "font-medium text-sm sm:text-base", 
                                    tempSelectedBatch === b ? "text-indigo-900" : "text-slate-700"
                                )}>
                                    {b}
                                </span>
                                <div className={cn(
                                    "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                                    tempSelectedBatch === b 
                                        ? "border-indigo-600 bg-indigo-600" 
                                        : "border-slate-300"
                                )}>
                                    {tempSelectedBatch === b && (
                                        <div className="w-2 h-2 bg-white rounded-full" />
                                    )}
                                </div>
                            </div>
                        ))}
                     </div>

                     <div className="p-6 border-t border-slate-100 bg-white">
                        <Button 
                            onClick={confirmBatchSwitch}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 rounded-xl text-base font-semibold shadow-lg shadow-indigo-200 active:scale-[0.98] transition-all"
                        >
                            Switch Batch
                        </Button>
                     </div>
                  </SheetContent>
                </Sheet>
              )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-6 bg-white/70 backdrop-blur-md border-t border-indigo-50">
          <nav className="flex gap-6 overflow-x-auto w-full sm:w-auto no-scrollbar">
            {[
              { id: 'classes', label: 'All Classes' },
              { id: 'live', label: 'Join Live Class' },
              { id: 'announcements', label: 'Announcements' },
              { id: 'community', label: 'Community' },
              { id: 'connect', label: 'Support Connect' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={cn(
                  "py-4 text-[14px] font-medium transition-colors relative whitespace-nowrap",
                  activeTab === tab.id 
                    ? "text-violet-700 font-semibold" 
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 w-full h-[3px] bg-violet-600 rounded-t-full" />
                )}
              </button>
            ))}
          </nav>

          {/* Enroll More Button */}
          <button 
            onClick={() => window.open('https://www.unknowniitians.com/courses', '_blank')}
            className="hidden sm:flex items-center gap-2 px-4 py-2 my-3 sm:my-0 rounded-lg bg-white border border-indigo-100 text-[13px] font-medium text-slate-600 hover:text-violet-700 hover:border-violet-200 hover:bg-violet-50/50 transition-all shadow-sm"
          >
            <img 
              src="https://res.cloudinary.com/dkywjijpv/image/upload/v1769193106/UI_Logo_yiput4.png" 
              alt="UI" 
              className="h-4 w-auto object-contain" 
            />
            Enroll More
          </button>
        </div>
      </header>

      {/* CONTENT SECTION */}
      <div className="w-full bg-white rounded-t-none rounded-b-lg shadow-sm border border-slate-100 p-6 md:p-8 h-auto min-h-[400px]">
        {renderTabContent()}
      </div>
    </div>
  );
};

export const StudentMain = StudentMainContent;
