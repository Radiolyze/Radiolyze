import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { toast } from "sonner";
import ErrorBoundary from "@/components/Common/ErrorBoundary";
import { setApiErrorHandler } from "@/services/apiClient";
import Index from "./pages/Index";
import Settings from "./pages/Settings";
import History from "./pages/History";
import Batch from "./pages/Batch";
import Training from "./pages/Training";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    setApiErrorHandler((error) => {
      if (error.status === 401) return; // handled by redirect
      if (error.status === 429) {
        toast.error("Zu viele Anfragen. Bitte kurz warten.");
        return;
      }
      const detail =
        typeof error.payload === "object" && error.payload !== null && "detail" in error.payload
          ? String((error.payload as Record<string, unknown>).detail)
          : error.message;
      toast.error(`Fehler ${error.status}: ${detail}`);
    });
    return () => setApiErrorHandler(null);
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Index />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/history" element={<History />} />
            <Route path="/batch" element={<Batch />} />
            <Route path="/training" element={<Training />} />
            <Route path="/dashboard" element={<Dashboard />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
