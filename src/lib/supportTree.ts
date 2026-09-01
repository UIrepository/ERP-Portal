// Guided support tree (zero-cost, selectable — no typing/AI needed).
// Categories & sub-issues are ordered by what students ACTUALLY ask most, from
// an analysis of ~1,100 support/doubt DMs + ~1,450 community messages:
//   1) "I paid but can't see my subjects/lectures/DPPs" (top frustration)
//   2) live class join, 3) recordings, 4) notes/DPP, 5) schedule/timing,
//   6) exams, 7) subject doubts, 8) payment, 9) app/technical.
// Each leaf gives a self-serve answer first; only if it doesn't help does the
// student "Connect to a person", auto-routed by `route` (they never pick a dept).

export type SupportRoute = 'admin' | 'manager' | 'teacher';

export interface SupportLeaf {
  id: string;
  q: string;                          // the selectable sub-issue
  a: string;                          // self-serve answer
  href?: { label: string; url: string };
  route: SupportRoute;                // who to escalate to if unresolved
}

export interface SupportCategory {
  id: string;
  label: string;
  blurb?: string;
  leaves: SupportLeaf[];
}

export const SUPPORT_TREE: SupportCategory[] = [
  {
    id: 'access',
    label: "I can't see my subjects / content",
    blurb: 'Paid but nothing is showing',
    leaves: [
      {
        id: 'paid-no-access',
        q: "I paid but my subjects/lectures aren't showing",
        a: "Make sure you're signed in with the SAME Google account you used to register for the batch — that's the #1 cause. Access can also take a little time to reflect right after payment. If your subjects still don't appear after signing in with the correct account, connect below and we'll fix it.",
        route: 'admin',
      },
      {
        id: 'weeks-missing',
        q: 'Some weeks / lectures are missing',
        a: "Lectures are uploaded as each class happens, so newer weeks appear over time. Older weeks are added progressively. If a specific past lecture that should be there is missing, connect below with the subject and week.",
        route: 'admin',
      },
      {
        id: 'video-removed',
        q: "A video says 'removed' or won't open",
        a: "This usually means the lecture is being re-processed or re-uploaded. Try again in a bit. If it stays broken, connect below with the subject and lecture number.",
        route: 'admin',
      },
    ],
  },
  {
    id: 'live',
    label: 'Live classes',
    leaves: [
      {
        id: 'how-join',
        q: 'How do I join a live class?',
        a: "Go to the 'Join Live Class' tab (or the Today's Class strip on your dashboard). When a class is live, a Join button appears there — tap it to enter.",
        route: 'admin',
      },
      {
        id: 'cant-join',
        q: "Class is live but I can't join / 'Waiting for teacher'",
        a: "Give it up to ~5 minutes after the start time — the Join button opens automatically once the class has begun, even if the teacher's 'live' signal is slow. If it's well past the start and still locked, connect below.",
        route: 'admin',
      },
      {
        id: 'when-start',
        q: 'When does my class start?',
        a: "Open the Schedule tab to see today's and upcoming class timings for your batch.",
        route: 'manager',
      },
    ],
  },
  {
    id: 'recordings',
    label: 'Recordings / Lectures',
    leaves: [
      {
        id: 'where',
        q: 'Where do I find recordings?',
        a: "Open a subject from your dashboard → 'Lectures'. All recorded classes for that subject are listed there.",
        route: 'admin',
      },
      {
        id: 'when-available',
        q: 'When will the recording be available?',
        a: "Recordings are posted right after the class ends. If a class just finished, give it a short while and refresh.",
        route: 'manager',
      },
      {
        id: 'wont-play',
        q: "Video won't play / keeps buffering",
        a: "Refresh the page and check your internet. If it still won't play on a good connection, connect below with the subject and lecture.",
        route: 'admin',
      },
    ],
  },
  {
    id: 'notes',
    label: 'Notes & DPPs',
    leaves: [
      {
        id: 'where',
        q: 'Where are the notes / DPPs?',
        a: "Open a subject → 'Notes & PDFs' for study material, and 'DPPs' for daily practice problems.",
        route: 'admin',
      },
      {
        id: 'when',
        q: 'When will DPPs / notes be uploaded?',
        a: "They're added alongside each class/week. Newer material appears as the week's classes are taught.",
        route: 'manager',
      },
      {
        id: 'wont-open',
        q: "A file won't open / download",
        a: "Tap the download button on the card; it opens the file in a new tab. If a specific file is broken, connect below with its name.",
        route: 'admin',
      },
    ],
  },
  {
    id: 'schedule',
    label: 'Schedule / Timings',
    leaves: [
      {
        id: 'where',
        q: 'Where is my timetable?',
        a: "The Schedule tab shows your full class timetable for all your enrolled batches.",
        route: 'manager',
      },
      {
        id: 'batch-start',
        q: "When does my batch / classes start?",
        a: "Batch start dates and the weekly schedule appear in the Schedule tab and in Announcements. If it's blank for a batch you just joined, connect below.",
        route: 'manager',
      },
      {
        id: 'time-changed',
        q: 'A class time changed / was rescheduled',
        a: "Timing changes are posted in Announcements. Check there for the latest; if something looks wrong, connect below.",
        route: 'manager',
      },
    ],
  },
  {
    id: 'exams',
    label: 'Exams / Results',
    leaves: [
      {
        id: 'when',
        q: 'When is the exam / where is the exam schedule?',
        a: "Exam dates for your batch are shared in the Exams tab and Announcements. Connect below if you can't find yours.",
        route: 'manager',
      },
      {
        id: 'prep',
        q: 'How do I prepare / where are PYQs & practice?',
        a: "Use the DPPs and PYQ/practice material inside each subject, plus recorded revision sessions. For subject-specific guidance, use 'Subject doubt' to reach your teacher.",
        route: 'manager',
      },
      {
        id: 'results',
        q: 'Results / marks',
        a: "Results are announced when released — check Announcements. Connect below if you have a specific result query.",
        route: 'manager',
      },
    ],
  },
  {
    id: 'subject-doubt',
    label: 'Subject doubt (ask a teacher)',
    blurb: 'A concept or question in a subject',
    leaves: [
      {
        id: 'ask-teacher',
        q: 'I have a doubt in one of my subjects',
        a: "Pick the subject on the next step and we'll connect you to that subject's teacher.",
        route: 'teacher',
      },
    ],
  },
  {
    id: 'payment',
    label: 'Payment / Enrollment',
    leaves: [
      {
        id: 'paid-no-access',
        q: "I paid but don't have access",
        a: "First check you're signed in with the same Google account you registered with. Access can take a little time after payment. If it still isn't there, connect below.",
        route: 'admin',
      },
      {
        id: 'buy-more',
        q: 'I want to buy / add more courses',
        a: "You can enroll in more courses on the Unknown IITians website.",
        href: { label: 'Browse courses', url: 'https://www.unknowniitians.com/courses' },
        route: 'admin',
      },
      {
        id: 'wrong-batch',
        q: "I'm in the wrong batch",
        a: "Connect below and tell us your correct batch — we'll sort out the enrollment.",
        route: 'admin',
      },
    ],
  },
  {
    id: 'technical',
    label: 'App / Technical',
    leaves: [
      {
        id: 'login',
        q: "I can't log in",
        a: "Sign in with the SAME Google account you used to register. If a blank screen appears, try a normal (non-incognito) browser tab. Still stuck? Connect below.",
        route: 'admin',
      },
      {
        id: 'notifications',
        q: "I'm not getting notifications",
        a: "Install the app (Get the app in the menu) and allow notifications when prompted. Connect below if they still don't arrive.",
        route: 'admin',
      },
      {
        id: 'install',
        q: 'How do I install the app?',
        a: "Use 'Get the app' in the side menu — it installs the portal like an app for a faster, full-screen experience with notifications.",
        route: 'admin',
      },
    ],
  },
];

// Simple keyword ranker for the optional search box — no AI, just relevance
// over the tree's question text + answers.
export interface SupportHit { cat: SupportCategory; leaf: SupportLeaf; score: number }
export function searchSupport(query: string, max = 4): SupportHit[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const hits: SupportHit[] = [];
  for (const cat of SUPPORT_TREE) {
    for (const leaf of cat.leaves) {
      const hay = `${cat.label} ${leaf.q} ${leaf.a}`.toLowerCase();
      let score = 0;
      for (const t of terms) if (hay.includes(t)) score += hay.indexOf(t) < leaf.q.length ? 2 : 1;
      if (score > 0) hits.push({ cat, leaf, score });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, max);
}
