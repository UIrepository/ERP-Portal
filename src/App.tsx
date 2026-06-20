import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ClassSession from "./pages/ClassSession";
import LecturePlayer from "./pages/LecturePlayer";
import Whiteboard from "./pages/Whiteboard";
import { ScreenRecordingProtection } from "@/components/ScreenRecordingProtection";
import { InstallAppBanner } from "@/components/InstallAppBanner";

// Import Community Components
import { StudentCommunity } from "@/components/student/StudentCommunity";
import { TeacherCommunity } from "@/components/teacher/TeacherCommunity";

// Egress-conscious defaults: don't refetch on every window/tab focus or
// reconnect, keep data fresh for a minute, and don't hammer retries.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <ScreenRecordingProtection>
          <Toaster />
          <Sonner />
          {/* The whiteboard opens in its own full-screen tab — never show the
              install banner there. */}
          {!window.location.pathname.startsWith('/whiteboard') && <InstallAppBanner />}
          <BrowserRouter>
            <Routes>
              {/* Root Route - Index will redirect to default tab */}
              <Route path="/" element={<Index />} />
              
              {/* SECURE CLASS SESSION ROUTE */}
              <Route path="/class-session/:enrollmentId" element={<ClassSession />} />

              {/* STANDALONE LECTURE PLAYER (opens in new tab) */}
              <Route path="/lecture/:recordingId" element={<LecturePlayer />} />

              {/* WHITEBOARD (opens in new tab) */}
              {/* General-purpose teacher whiteboard "file" (own tab) */}
              <Route path="/whiteboard/file/:fileId" element={<Whiteboard />} />
              <Route path="/whiteboard/:scheduleId" element={<Whiteboard />} />
              
              {/* COMMUNITY ROUTES (Open in new tabs) */}
              <Route path="/portal/student/community" element={<StudentCommunity />} />
              <Route path="/teacher-community" element={<TeacherCommunity />} />
              
              {/* Dynamic Dashboard Tabs (e.g., /schedule, /exams) */}
              {/* Placed after specific routes to avoid conflicts */}
              <Route path="/:tab" element={<Index />} />
              
              {/* Fallback Route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ScreenRecordingProtection>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
