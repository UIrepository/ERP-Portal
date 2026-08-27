import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { StudentSubjectCard } from './StudentSubjectCard';
import { StudentSubjectBlocks } from './StudentSubjectBlocks';
import { StudentBlockContent } from './StudentBlockContent';
import { ContinueWatchingStrip } from './ContinueWatchingStrip';
import { TodaysClassStrip } from './TodaysClassStrip';
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
import { FullScreenVideoPlayer } from '@/components/video-player/FullScreenVideoPlayer';
import { Lecture } from '@/components/video-player/types';
import { GuidedTour, TourStep } from './GuidedTour';

// Bump this key to re-show the walkthrough to everyone after a nav change.
// The steps are built inside the component (below) because they drive the app's
// own navigation (open a subject → its blocks → lectures/notes).
const STUDENT_TOUR_KEY = 'ui_ssp_tour_v2';

interface UserEnrollment {
  batch_name: string;
  subject_name: string;
  created_at: string;
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
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('classes');
  const [isInitialized, setIsInitialized] = useState(false);
  const { openSupportDrawer } = useChatDrawer();
  const [showTutorial, setShowTutorial] = useState(false);
  
  const [navigation, setNavigation] = useState<NavigationState>({
    level: 'batch',
    batch: null,
    subject: null,
    block: null,
  });

  // Batch Switcher State
  const [isBatchSheetOpen, setIsBatchSheetOpen] = useState(false);
  const [tempSelectedBatch, setTempSelectedBatch] = useState<string | null>(null);

  // Tutorial Video Configuration
  const tutorialLecture: Lecture = {
    id: 'student-tutorial',
    title: 'How to use the Student Portal',
    videoUrl: 'https://youtu.be/nePZER6PTjQ',
    subject: 'Tutorial',
    duration: '5:00'
  };

  // Fetch user enrollments
  const userId = user?.id || profile?.user_id;

  const { data: userEnrollments, isLoading: isLoadingEnrollments } = useQuery<UserEnrollment[]>({
    queryKey: ['studentMainEnrollments', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('user_enrollments')
        .select('batch_name, subject_name, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) return [];
      return (data || []) as UserEnrollment[];
    },
    enabled: !!userId,
  });

  // Derive available batches - preserve insertion order (latest first)
  const availableBatches = useMemo(() => {
    return Array.from(new Set(userEnrollments?.map((e) => e.batch_name) || []));
  }, [userEnrollments]);

  // Update URL when navigation changes
  const updateUrl = useCallback((nav: NavigationState) => {
    const params = new URLSearchParams();
    if (nav.batch) params.set('batch', nav.batch);
    if (nav.subject) params.set('subject', nav.subject);
    if (nav.block) params.set('block', nav.block);
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  // Initialize navigation from URL or localStorage
  useEffect(() => {
    if (!userEnrollments || userEnrollments.length === 0 || isInitialized) return;
    
    const batchParam = searchParams.get('batch');
    const subjectParam = searchParams.get('subject');
    const blockParam = searchParams.get('block');
    const savedBatch = localStorage.getItem('student-selected-batch');
    
    // Priority: URL param > localStorage > latest enrolled batch
    let validBatch: string | null = null;
    if (batchParam && availableBatches.includes(batchParam)) {
      validBatch = batchParam;
    } else if (savedBatch && availableBatches.includes(savedBatch)) {
      validBatch = savedBatch;
    } else {
      validBatch = availableBatches[0] || null;
    }
    
    // Persist the selection
    if (validBatch) {
      localStorage.setItem('student-selected-batch', validBatch);
    }
    
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
    if (!userId) return;
    const channel = supabase
      .channel('student-main-enrollments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_enrollments', filter: `user_id=eq.${userId}` }, () => {
          queryClient.invalidateQueries({ queryKey: ['studentMainEnrollments'] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  // Navigation handlers
  const handleSelectBatch = (batch: string) => {
    localStorage.setItem('student-selected-batch', batch);
    // Let the mandatory feedback gate re-evaluate for the newly-selected batch.
    window.dispatchEvent(new Event('student-batch-changed'));
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
      // Always navigate in-place so the PWA never breaks out into the browser.
      navigate('/portal/student/community');
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

  // Drill-in screens (subject → blocks → block content). Rendered as a variable
  // (not an early return) so the GuidedTour below stays mounted across levels.
  const drillScreen =
    navigation.level === 'block' && navigation.batch && navigation.subject && navigation.block ? (
      <StudentBlockContent
        blockId={navigation.block}
        batch={navigation.batch}
        subject={navigation.subject}
        onBack={handleBackToBlocks}
      />
    ) : navigation.level === 'subject' && navigation.batch && navigation.subject ? (
      <StudentSubjectBlocks
        batch={navigation.batch}
        subject={navigation.subject}
        onBack={handleBackToSubjects}
        onBlockSelect={handleSelectBlock}
      />
    ) : null;

  // --- Main Batch Level View ---
  const renderTabContent = () => {
    switch (activeTab) {
      case 'classes':
        return (
          <div data-tour="subjects" className="w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
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
             <StudentLiveClass batch={navigation.batch} enrolledSubjects={subjectsForBatch} />
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
      navigate('/portal/student/community');
    } else {
      setActiveTab(tabId as TabType);
    }
  };

  // ----- Guided onboarding tour -----
  // Steps live here (not module scope) because they DRIVE the app's own
  // navigation: dashboard → open a subject → its blocks → into the lectures &
  // notes lists. Each beforeStep sets ABSOLUTE state so Back/Next both land right.
  const firstSubject = subjectsForBatch[0];
  const applyNav = useCallback((nav: NavigationState) => {
    setNavigation(nav);
    updateUrl(nav);
  }, [updateUrl]);

  const tourSteps: TourStep[] = useMemo(() => {
    const b = navigation.batch;
    const goDash = () => {
      setActiveTab('classes');
      applyNav({ level: 'batch', batch: b, subject: null, block: null });
    };
    const steps: TourStep[] = [
      { icon: '👋', title: 'Welcome to your dashboard', body: 'A quick guided tour so you always know where your classes, notes and everything else live. Takes about a minute — you can skip anytime.', beforeStep: goDash },
      { selector: '[data-tour="header"]', icon: '🎓', title: 'Your batch', body: 'This shows the batch you’re currently viewing. Enrolled in more than one? Use “Switch Batch” up here to jump between them.', beforeStep: goDash },
      // Side menu (left rail on desktop, bottom bar on mobile) — the top-level
      // pages. We spotlight each in place without navigating, so the tour stays
      // on the dashboard while it points them out.
      { selector: '[data-tour="nav-dashboard"]', title: 'Home', body: 'This is Home — the dashboard you’re on now, with your subjects, live classes and today’s activity.', beforeStep: goDash },
      { selector: '[data-tour="nav-schedule"]', title: 'Schedule', body: 'Your full class timetable — see which classes are coming up and when. Open it from here anytime.', beforeStep: goDash },
      { selector: '[data-tour="nav-feedback"]', title: 'Feedback', body: 'Share feedback about your classes and teachers here — it genuinely helps us improve.', beforeStep: goDash },
      { selector: '[data-tour="nav-exams"]', title: 'Exams', body: 'Your exam schedule and details live here — check it so you never miss a test.', beforeStep: goDash },
      { selector: '[data-tour="tab-classes"]', icon: '📚', title: 'All Classes', body: 'Your home base — pick a subject to open its recorded lectures, notes and daily practice problems.', beforeStep: goDash },
      { selector: '[data-tour="tab-live"]', icon: '🔴', title: 'Join Live Class', body: 'When a class is happening live, a Join button appears here to take you straight into it.', beforeStep: goDash },
      { selector: '[data-tour="tab-announcements"]', icon: '📢', title: 'Announcements', body: 'Notices, schedule changes and important messages from your teachers land here — check it often.', beforeStep: goDash },
      { selector: '[data-tour="tab-community"]', icon: '💬', title: 'Community', body: 'A group chat for your batch — ask doubts, talk to teachers and share resources.', beforeStep: goDash },
      { selector: '[data-tour="tab-connect"]', icon: '🛟', title: 'Support Connect', body: 'Facing a technical issue or have a question? Reach the support team directly from here.', beforeStep: goDash },
      { selector: '[data-tour="tutorial"]', icon: '🎬', title: 'How to use me?', body: 'Prefer watching? This plays a full video walkthrough of the portal anytime.', beforeStep: goDash },
      { selector: '[data-tour="subjects"]', icon: '✨', title: 'Your subjects', body: 'Each card is a subject. Let’s open one and see what’s inside →', beforeStep: goDash },
    ];

    if (firstSubject) {
      const openSubject = () => applyNav({ level: 'subject', batch: b, subject: firstSubject, block: null });
      const openBlock = (id: string) => applyNav({ level: 'block', batch: b, subject: firstSubject, block: id });
      steps.push(
        { selector: '[data-tour="blocks-grid"]', icon: '🗂️', title: `Inside “${firstSubject}”`, body: 'Every subject opens into these sections — lectures, notes, DPPs and more. Here’s what each one holds:', beforeStep: openSubject },
        { selector: '[data-tour="block-recordings"]', icon: '▶️', title: 'Lectures', body: 'All recorded classes for this subject live here. Let’s open it →', beforeStep: openSubject },
        { selector: '[data-tour="recordings-list"]', icon: '🎥', title: 'Recorded lectures', body: 'Each past class appears as a card — tap any card to watch it. (We won’t open the video now.)', beforeStep: () => openBlock('recordings') },
        { selector: '[data-tour="block-notes"]', icon: '📝', title: 'Notes & PDFs', body: 'Back in the subject, “Notes & PDFs” has all your study material and assignments. Opening it →', beforeStep: openSubject },
        { selector: '[data-tour="notes-list"]', icon: '📄', title: 'Your notes & files', body: 'Notes and PDFs show as cards — tap the download button on any to open the file. (Links stay closed during the tour.)', beforeStep: () => openBlock('notes') },
        { selector: '[data-tour="block-dpps"]', icon: '🎯', title: 'DPPs', body: 'Daily Practice Problems to test yourself after each class.', beforeStep: openSubject },
        { selector: '[data-tour="block-ui-ki-padhai"]', icon: '⭐', title: 'UI Ki Padhai', body: 'Exclusive premium series and extra content curated just for you.', beforeStep: openSubject },
      );
    }

    steps.push({
      icon: '🚀', title: 'You’re all set!',
      body: 'That’s the whole portal. You can replay this tour anytime from “How to use me?”. Happy learning!',
      beforeStep: goDash,
    });
    return steps;
  }, [navigation.batch, firstSubject, applyNav]);

  const tourRun = isInitialized && !isLoadingEnrollments && subjectsForBatch.length > 0;

  return (
    <>
      {drillScreen ?? (
    // Outer Container
    <div className="w-full max-w-[1840px] mx-auto px-4 md:px-6 py-6 flex flex-col gap-6 min-h-screen font-sans">
      
      {/* HEADER SECTION */}
      <header className="w-full rounded-t-lg rounded-b-none overflow-hidden shadow-sm border border-indigo-100/50 relative z-10 group">
        
        {/* Banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-indigo-700 to-indigo-500 px-6 py-8 text-white">

          {/* Dot Pattern Overlay */}
          <div className="absolute inset-0 z-0 opacity-[0.18]"
               style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.8) 0.5px, transparent 0.5px)', backgroundSize: '12px 12px' }}>
          </div>

          {/* Premium light glows over the deep base for a mesh-gradient feel */}
          <div className="pointer-events-none absolute -top-20 -right-12 h-60 w-60 rounded-full bg-indigo-300/30 blur-3xl z-0" />
          <div className="pointer-events-none absolute -bottom-24 left-1/4 h-52 w-52 rounded-full bg-indigo-400/25 blur-3xl z-0" />
          <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(255,255,255,0.12),transparent_55%)]" />
          
          <div data-tour="header" className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Title - Arrow REMOVED */}
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {navigation.batch || "No Batch Selected"}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              {/* Tutorial Button */}
              <Button
                data-tour="tutorial"
                variant="outline"
                className="bg-white/15 backdrop-blur-xl backdrop-saturate-150 border-white/30 text-white hover:bg-white/25 hover:text-white shadow-lg shadow-black/10 gap-2 font-sans font-normal"
                onClick={() => setShowTutorial(true)}
              >
                How to use me?
              </Button>

              {/* SWITCH BATCH BUTTON */}
              {availableBatches.length > 1 && (
                  <Sheet open={isBatchSheetOpen} onOpenChange={setIsBatchSheetOpen}>
                    <SheetTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="bg-white/15 backdrop-blur-xl backdrop-saturate-150 border-white/30 text-white hover:bg-white/25 hover:text-white shadow-lg shadow-black/10 gap-2 font-medium"
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
                data-tour={`tab-${tab.id}`}
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

      {/* TODAY'S CLASS + CONTINUE WATCHING — only on the All Classes tab, not
          on Live / Announcements / Community / Support. Each hides itself when
          it has nothing to show. */}
      {activeTab === 'classes' && (
        <>
          <TodaysClassStrip
            batch={navigation.batch}
            enrolledSubjects={subjectsForBatch}
            onJoinLive={() => setActiveTab('live')}
          />
          <ContinueWatchingStrip userId={user?.id} batch={navigation.batch} />
        </>
      )}

      {/* CONTENT SECTION */}
      <div className="w-full bg-white rounded-t-none rounded-b-lg shadow-sm border border-slate-100 p-3 sm:p-6 md:p-8 h-auto min-h-[400px]">
        {renderTabContent()}
      </div>

      {/* Video Player Overlay */}
      {showTutorial && (
        <FullScreenVideoPlayer
          currentLecture={tutorialLecture}
          lectures={[tutorialLecture]}
          onClose={() => setShowTutorial(false)}
          userName={profile?.name}
        />
      )}

    </div>
      )}

      {/* First-login onboarding walkthrough — mounted outside the level branching
          so it stays alive while it drives the app through subjects & blocks. */}
      <GuidedTour steps={tourSteps} storageKey={STUDENT_TOUR_KEY} run={tourRun} />
    </>
  );
};

export const StudentMain = StudentMainContent;
