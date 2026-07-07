import { useEffect, Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { toast } from "sonner";
import ErrorBoundary from "@/components/Common/ErrorBoundary";
import { setApiErrorHandler } from "@/services/apiClient";
import i18n from "@/i18n";

const Index = lazy(() => import("./pages/Index"));
const Settings = lazy(() => import("./pages/Settings"));
const History = lazy(() => import("./pages/History"));
const Batch = lazy(() => import("./pages/Batch"));
const Training = lazy(() => import("./pages/Training"));
const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Monitoring = lazy(() => import("./pages/Monitoring"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function RouteFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

const App = () => {
  useEffect(() => {
    setApiErrorHandler((error) => {
      if (error.status === 401) return; // handled by redirect
      if (error.status === 429) {
        toast.error(i18n.t("api.rateLimited", { ns: "errors" }));
        return;
      }
      const detail =
        typeof error.payload === "object" && error.payload !== null && "detail" in error.payload
          ? String((error.payload as Record<string, unknown>).detail)
          : error.message;
      toast.error(i18n.t("api.errorWithStatus", { ns: "errors", status: error.status, detail }));
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
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Index />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/history" element={<History />} />
                <Route path="/batch" element={<Batch />} />
                <Route path="/training" element={<Training />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/monitoring" element={<Monitoring />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
