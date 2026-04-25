import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useState, useEffect, lazy, Suspense } from "react";
import { trackEvent } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { WAYS_PHONE_DISPLAY, WAYS_PHONE_TEL } from "@/lib/constants";
// Eager-load homepage variants (LCP path); lazy-load everything else.
import Index from "./pages/Index.tsx";
import HomeMobile from "./pages/HomeMobile.tsx";
import HolidayBanner from "./components/HolidayBanner";

const Order = lazy(() => import("./pages/Order.tsx"));
const OrderMobile = lazy(() => import("./pages/OrderMobile.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const AdminLogin = lazy(() => import("./pages/AdminLogin.tsx"));
const Leads = lazy(() => import("./pages/Leads.tsx"));
const LeadsSetup2FA = lazy(() => import("./pages/LeadsSetup2FA.tsx"));
const CityPage = lazy(() => import("./pages/CityPage.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Review = lazy(() => import("./pages/Review.tsx"));
// Path B Phase 3a — driver portal auth foundation
const Driver = lazy(() => import("./pages/Driver.tsx"));

const RouteFallback = () => (
  <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ width: 32, height: 32, border: "3px solid #E8E5DC", borderTopColor: "#C07A00", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const queryClient = new QueryClient();

const HomeRouter = () => {
  const forceDesktop = typeof window !== 'undefined' && localStorage.getItem("force_desktop") === "true";
  const isMobile = useIsMobile();
  return (!forceDesktop && isMobile) ? <HomeMobile /> : <Index />;
};

const OrderRouter = () => {
  const forceDesktop = typeof window !== 'undefined' && localStorage.getItem("force_desktop") === "true";
  const isMobile = useIsMobile();
  return (!forceDesktop && isMobile) ? <OrderMobile /> : <Order />;
};


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
        href={WAYS_PHONE_TEL}
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
        📞 {WAYS_PHONE_DISPLAY}
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
        width: '97px',
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
    <button
      onClick={() => {
        sessionStorage.setItem("maintenance_bypass", "true");
        window.location.reload();
      }}
      style={{
        color: 'rgba(255,255,255,0.15)',
        fontSize: '10px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        marginTop: '24px',
        display: 'block',
        letterSpacing: '1px',
      }}
    >
      admin
    </button>
  </div>
);

function AppContent() {
  const location = useLocation();
  const [siteMode, setSiteMode] = useState("live");
  const [stripeMode, setStripeMode] = useState("live");
  const [showTestModal, setShowTestModal] = useState(false);

  const isAdminRoute =
    location.pathname.startsWith("/leads") ||
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/driver");

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setSiteMode("live");
    }, 3000);

    supabase
      .from("global_settings")
      .select("key, value")
      .in("key", ["site_mode", "stripe_mode"])
      .then(({ data, error }) => {
        if (cancelled) return;
        clearTimeout(timeout);
        const settings: Record<string, string> = {};
        data?.forEach((r) => { settings[r.key] = r.value; });
        setSiteMode(error ? "live" : settings.site_mode || "live");
        const sm = settings.stripe_mode || "live";
        setStripeMode(sm);
        if (sm === "test") {
          const dismissed = sessionStorage.getItem("test_modal_dismissed");
          if (!dismissed) setShowTestModal(true);
        }
      });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  // GTM is hardcoded in index.html. This effect injects Microsoft Clarity only
  // (excluding /leads and /admin) from global_settings.seo_clarity_id.
  useEffect(() => {
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    if (path.startsWith("/leads") || path.startsWith("/admin")) return;

    supabase
      .from("global_settings")
      .select("key, value")
      .eq("key", "seo_clarity_id")
      .maybeSingle()
      .then(({ data }) => {
        const clarityId = (data as { value?: string } | null)?.value;
        if (clarityId && typeof document !== "undefined" && !document.getElementById("clarity-script")) {
          const s = document.createElement("script");
          s.id = "clarity-script";
          s.innerHTML = `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityId}");`;
          document.head.appendChild(s);
        }
      });
  }, []);

  // Set CSS variable for banner offset so Navbar shifts down
  useEffect(() => {
    const showBanner = typeof window !== "undefined" && stripeMode === "test" && !isAdminRoute && window.innerWidth >= 768;
    document.documentElement.style.setProperty("--banner-offset", showBanner ? "36px" : "0px");
    return () => { document.documentElement.style.setProperty("--banner-offset", "0px"); };
  }, [stripeMode, isAdminRoute]);

  const maintenanceBypassed = typeof window !== "undefined" && sessionStorage.getItem("maintenance_bypass") === "true";
  if (siteMode === "maintenance" && !isAdminRoute && !maintenanceBypassed) {
    return <MaintenancePage />;
  }

  return (
    <div suppressHydrationWarning={true}>
      <HolidayBanner />
      
      {typeof window !== "undefined" && stripeMode === "test" && !isAdminRoute && (
        <div id="stripe-test-banner" suppressHydrationWarning={true} className="hidden md:flex" style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          width: "100%",
          backgroundColor: "#EA580C",
          color: "#FFFFFF",
          textAlign: "center",
          padding: "8px 16px",
          fontSize: "13px",
          fontWeight: "bold",
          letterSpacing: "0.5px",
          zIndex: 9999,
          height: "36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          🔧 PAYMENT TEST MODE — Orders placed will not be charged &nbsp;|&nbsp;
          <a
            href={WAYS_PHONE_TEL}
            style={{
              color: "#FFFFFF",
              textDecoration: "underline",
              marginLeft: "4px",
            }}
          >
            1-855-468-9297
          </a>
          &nbsp;for instant order assistance
        </div>
      )}
      <PageViewTracker />
      <Routes>
        <Route path="/" element={<HomeRouter />} />
        <Route path="/products/river-sand" element={<Navigate to="/" replace />} />
        <Route path="/order" element={<Suspense fallback={<RouteFallback />}><OrderRouter /></Suspense>} />
        <Route path="/admin" element={<Suspense fallback={<RouteFallback />}><Admin /></Suspense>} />
        <Route path="/admin/login" element={<Suspense fallback={<RouteFallback />}><AdminLogin /></Suspense>} />
        <Route path="/leads" element={<Suspense fallback={<RouteFallback />}><Leads /></Suspense>} />
        <Route path="/leads/setup-2fa" element={<Suspense fallback={<RouteFallback />}><LeadsSetup2FA /></Suspense>} />
        <Route path="/review" element={<Suspense fallback={<RouteFallback />}><Review /></Suspense>} />
        <Route path="/chalmette-la/river-sand-delivery" element={<Navigate to="/chalmette/river-sand-delivery" replace />} />
        <Route path="/bridge-city-la/river-sand-delivery" element={<Navigate to="/bridge-city/river-sand-delivery" replace />} />
        <Route path="/destrehan-la/river-sand-delivery" element={<Navigate to="/destrehan/river-sand-delivery" replace />} />
        <Route path="/kenner-la/river-sand-delivery" element={<Navigate to="/kenner/river-sand-delivery" replace />} />
        <Route path="/luling-la/river-sand-delivery" element={<Navigate to="/luling/river-sand-delivery" replace />} />
        <Route path="/meraux-la/river-sand-delivery" element={<Navigate to="/meraux/river-sand-delivery" replace />} />
        <Route path="/metairie-la/river-sand-delivery" element={<Navigate to="/metairie/river-sand-delivery" replace />} />
        <Route path="/new-orleans-la/river-sand-delivery" element={<Navigate to="/new-orleans/river-sand-delivery" replace />} />
        <Route path="/:citySlug/river-sand-delivery" element={<Suspense fallback={<RouteFallback />}><CityPage /></Suspense>} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<Suspense fallback={<RouteFallback />}><NotFound /></Suspense>} />
      </Routes>
      {typeof window !== "undefined" && stripeMode === "test" && showTestModal && !isAdminRoute && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.7)",
          zIndex: 99999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          backdropFilter: "blur(4px)",
        }}>
          <div style={{
            backgroundColor: "#FFFFFF",
            borderRadius: "20px",
            padding: "40px 32px",
            maxWidth: "420px",
            width: "100%",
            textAlign: "center",
            boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
          }}>
            <img
              src="https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/riversand-logo_BLACK.png.png"
              alt="River Sand"
              style={{ width: "160px", marginBottom: "24px" }}
            />
            <div style={{
              width: "40px",
              height: "2px",
              backgroundColor: "#C07A00",
              margin: "0 auto 24px auto",
            }} />
            <div style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: "#FEF3C7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px auto",
              fontSize: "28px",
            }}>
              🔧
            </div>
            <h2 style={{
              color: "#0D2137",
              fontSize: "22px",
              fontWeight: "bold",
              margin: "0 0 12px 0",
              letterSpacing: "0.5px",
            }}>
              We're Improving Your Experience
            </h2>
            <p style={{
              color: "#666",
              fontSize: "14px",
              lineHeight: "1.7",
              margin: "0 0 8px 0",
            }}>
              Our team is currently making improvements to our ordering system. The site is fully functional but <strong>payments are in test mode</strong> — no real charges will be made.
            </p>
            <p style={{
              color: "#666",
              fontSize: "14px",
              lineHeight: "1.7",
              margin: "0 0 28px 0",
            }}>
              We appreciate your patience and will be fully live shortly.
            </p>
            <button
              onClick={() => {
                sessionStorage.setItem("test_modal_dismissed", "true");
                setShowTestModal(false);
              }}
              style={{
                display: "block",
                width: "100%",
                backgroundColor: "#0D2137",
                color: "#FFFFFF",
                border: "none",
                borderRadius: "10px",
                padding: "14px 24px",
                fontSize: "15px",
                fontWeight: "bold",
                cursor: "pointer",
                marginBottom: "16px",
                letterSpacing: "0.5px",
              }}
            >
              Continue to Site →
            </button>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              margin: "0 0 16px 0",
            }}>
              <div style={{ flex: 1, height: "1px", backgroundColor: "#E8E5DC" }} />
              <span style={{ color: "#999", fontSize: "12px" }}>or</span>
              <div style={{ flex: 1, height: "1px", backgroundColor: "#E8E5DC" }} />
            </div>
            <a
              href={WAYS_PHONE_TEL}
              style={{
                display: "block",
                width: "100%",
                backgroundColor: "#C07A00",
                color: "#FFFFFF",
                borderRadius: "10px",
                padding: "14px 24px",
                fontSize: "15px",
                fontWeight: "bold",
                textDecoration: "none",
                letterSpacing: "0.5px",
                boxSizing: "border-box",
              }}
            >
              📞 Call {WAYS_PHONE_DISPLAY}
            </a>
            <p style={{
              color: "#999",
              fontSize: "11px",
              margin: "12px 0 0 0",
            }}>
              For instant order assistance
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
