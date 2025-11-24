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
import { GlucoseProvider, useGlucose } from "./context/GlucoseContext";
import { MadeWithDyad } from "./components/made-with-dyad";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { settings } = useGlucose();

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/connect-dexcom" element={<ConnectDexcom />} />
      <Route
        path="/dashboard"
        element={settings.dexcomConnected ? <Dashboard /> : <Navigate to="/connect-dexcom" />}
      />
      <Route
        path="/settings"
        element={settings.dexcomConnected ? <Settings /> : <Navigate to="/connect-dexcom" />}
      />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <GlucoseProvider>
        <BrowserRouter>
          <AppRoutes />
          <MadeWithDyad />
        </BrowserRouter>
      </GlucoseProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;