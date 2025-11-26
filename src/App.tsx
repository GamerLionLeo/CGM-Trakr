import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ConnectDexcom from "./pages/ConnectDexcom";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Login from "./pages/Login";
import DexcomCallback from "./pages/DexcomCallback";
import { GlucoseProvider, useGlucose } from "./context/GlucoseContext";
import { SessionContextProvider, useSession } from "./context/SessionContext";
import { MadeWithDyad } from "./components/made-with-dyad";

const queryClient = new QueryClient();

// A wrapper component to protect routes
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, isLoading } = useSession();

  if (isLoading) {
    // You can render a loading spinner here
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-xl text-gray-600 dark:text-gray-400">Loading authentication...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const AppRoutes = () => {
  const { settings } = useGlucose();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Index />} />
      <Route path="/dexcom-callback" element={<DexcomCallback />} />
      
      {/* Protected Routes */}
      <Route
        path="/connect-dexcom"
        element={
          <ProtectedRoute>
            <ConnectDexcom />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            {settings.dexcomConnected ? <Dashboard /> : <Navigate to="/connect-dexcom" />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            {settings.dexcomConnected ? <Settings /> : <Navigate to="/connect-dexcom" />}
          </ProtectedRoute>
        }
      />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SessionContextProvider> {/* SessionContextProvider now wraps GlucoseProvider */}
            <GlucoseProvider>
              <AppRoutes />
            </GlucoseProvider>
          </SessionContextProvider>
          <MadeWithDyad />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;