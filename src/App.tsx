import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ClassSession from "./pages/ClassSession";
import { ScreenRecordingProtection } from "@/components/ScreenRecordingProtection";

// Import Community Components
import { StudentCommunity } from "@/components/student/StudentCommunity";
import { TeacherCommunity } from "@/components/teacher/TeacherCommunity";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <ScreenRecordingProtection>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              
              {/* SECURE CLASS SESSION ROUTE */}
              <Route path="/class-session/:enrollmentId" element={<ClassSession />} />
              
              {/* COMMUNITY ROUTES (Open in new tabs) */}
              <Route path="/portal/student/community" element={<StudentCommunity />} />
              <Route path="/teacher-community" element={<TeacherCommunity />} />
              
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
