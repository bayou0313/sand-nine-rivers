import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import Index from "./pages/Index.tsx";
import Order from "./pages/Order.tsx";
import Admin from "./pages/Admin.tsx";
import AdminLogin from "./pages/AdminLogin.tsx";
import Leads from "./pages/Leads.tsx";
import CityPage from "./pages/CityPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const PageViewTracker = () => {
  const location = useLocation();
  useEffect(() => {
    trackEvent("page_view", {
      page_title: document.title,
      page_location: window.location.href,
      page_path: location.pathname,
    });
  }, [location.pathname]);
  return null;
};

const STRIPE_PK = "pk_test_51TH4PcPuKuZka3yZ4JaHNa9CME7k3KQKF0IMSsXDZ2SbGXL1oMGBqKYLJDVPLQhICFFs197Tb3GAFsWED68uB0eB00YUry3q85";
const IS_TEST_MODE = STRIPE_PK.startsWith("pk_test_");

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          {IS_TEST_MODE && (
            <div style={{
              width: '100%',
              backgroundColor: '#EA580C',
              color: '#FFFFFF',
              textAlign: 'center' as const,
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 'bold',
              letterSpacing: '0.5px',
              zIndex: 9999,
              position: 'relative' as const,
            }}>
              🔧 TEST MODE ACTIVE — For orders please call
              <a href="tel:18554689297"
                style={{ color: '#FFF', marginLeft: '6px', textDecoration: 'underline' }}>
                1-855-468-9297
              </a>
            </div>
          )}
          <PageViewTracker />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/products/river-sand" element={<Navigate to="/" replace />} />
            <Route path="/order" element={<Order />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/:citySlug/river-sand-delivery" element={<CityPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
