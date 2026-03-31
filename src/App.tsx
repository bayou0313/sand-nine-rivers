import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
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

const MaintenancePage = () => (
  <div style={{
    minHeight: '100vh',
    backgroundColor: '#0D2137',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    fontFamily: 'Arial, sans-serif',
    textAlign: 'center' as const,
  }}>
    <img
      src="https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/riversand-logo_WHITE.png.png"
      alt="River Sand"
      style={{ width: '240px', marginBottom: '16px' }}
    />
    <div style={{
      width: '60px',
      height: '3px',
      backgroundColor: '#C07A00',
      margin: '0 auto 32px auto',
    }} />
    <h1 style={{
      color: '#FFFFFF',
      fontSize: '32px',
      fontWeight: 'bold',
      margin: '0 0 16px 0',
      letterSpacing: '1px',
    }}>
      System Maintenance
    </h1>
    <p style={{
      color: 'rgba(255,255,255,0.7)',
      fontSize: '16px',
      maxWidth: '480px',
      lineHeight: '1.7',
      margin: '0 0 12px 0',
    }}>
      We are currently performing scheduled maintenance to improve your experience.
      Any orders entered during this period will not be processed.
    </p>
    <p style={{
      color: 'rgba(255,255,255,0.6)',
      fontSize: '15px',
      margin: '0 0 48px 0',
    }}>
      We will be back shortly. Thank you for your patience.
    </p>
    <div style={{
      backgroundColor: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(192,122,0,0.5)',
      borderRadius: '16px',
      padding: '32px 48px',
      marginBottom: '48px',
      maxWidth: '420px',
      width: '100%',
    }}>
      <p style={{
        color: '#C07A00',
        fontSize: '11px',
        fontWeight: 'bold',
        letterSpacing: '3px',
        textTransform: 'uppercase' as const,
        margin: '0 0 12px 0',
      }}>
        Need to place an order right now?
      </p>
      <p style={{
        color: 'rgba(255,255,255,0.55)',
        fontSize: '14px',
        lineHeight: '1.6',
        margin: '0 0 24px 0',
      }}>
        Our team is standing by to take your order and arrange same-day delivery.
      </p>
      <a
        href="tel:18554689297"
        style={{
          display: 'inline-block',
          backgroundColor: '#C07A00',
          color: '#FFFFFF',
          padding: '16px 40px',
          borderRadius: '10px',
          fontSize: '22px',
          fontWeight: 'bold',
          textDecoration: 'none',
          letterSpacing: '1px',
          boxShadow: '0 4px 20px rgba(192,122,0,0.4)',
        }}
      >
        📞 1-855-GOT-WAYS
      </a>
      <p style={{
        color: 'rgba(255,255,255,0.3)',
        fontSize: '12px',
        margin: '12px 0 0 0',
      }}>
        1-855-468-9297 • Available for same-day orders
      </p>
    </div>
    <p style={{
      color: 'rgba(255,255,255,0.25)',
      fontSize: '10px',
      letterSpacing: '3px',
      textTransform: 'uppercase' as const,
      margin: '0 0 10px 0',
    }}>
      Powered by
    </p>
    <img
      src="https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/WAYS_LOGO___-__WHITE.png.png"
      alt="WAYS"
      style={{
        width: '72px',
        opacity: 0.4,
        marginBottom: '32px',
      }}
    />
    <p style={{
      color: 'rgba(255,255,255,0.2)',
      fontSize: '12px',
      letterSpacing: '1px',
    }}>
      River Sand — Real Sand. Real People.
    </p>
  </div>
);

const App = () => {
  const [siteMode, setSiteMode] = useState<string | null>(null);
  const [siteModeLoading, setSiteModeLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // Safety timeout — never block rendering for more than 3s
    const timeout = setTimeout(() => {
      if (!cancelled) { setSiteMode("live"); setSiteModeLoading(false); }
    }, 3000);

    supabase
      .from("global_settings")
      .select("value")
      .eq("key", "site_mode")
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        clearTimeout(timeout);
        setSiteMode(error || !data ? "live" : data.value || "live");
        setSiteModeLoading(false);
      });

    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);

  const isAdminRoute = window.location.pathname.startsWith('/leads')
    || window.location.pathname.startsWith('/admin');

  if (siteModeLoading && !isAdminRoute) return null;

  if (siteMode === "maintenance" && !isAdminRoute) {
    return <MaintenancePage />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
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
};

export default App;
