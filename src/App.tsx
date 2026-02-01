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
              {/* This route verifies the unique link and redirects to Jitsi in a new tab */}
              <Route path="/class-session/:enrollmentId" element={<ClassSession />} />
              
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
