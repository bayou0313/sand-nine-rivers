import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import DeliveryEstimator from "@/components/DeliveryEstimator";
import About from "@/components/About";
import Stats from "@/components/Stats";
import RiverSandInfo from "@/components/RiverSandInfo";
import Features from "@/components/Features";
import Testimonials from "@/components/Testimonials";
import CTA from "@/components/CTA";
import FAQ from "@/components/FAQ";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";
import MobilePhoneBar from "@/components/MobilePhoneBar";
import ScrollToTop from "@/components/ScrollToTop";
import WhatsAppButton from "@/components/WhatsAppButton";
import ReturnVisitorBanner from "@/components/ReturnVisitorBanner";
import { initSession, getSession, incrementVisitCount, updateSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [session, setSession] = useState<any>(null);
  const [returnAddress, setReturnAddress] = useState<string | null>(null);
  const [seoSettings, setSeoSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    const init = async () => {
      await initSession();
      await incrementVisitCount();
      await updateSession({ stage: "visited" });
      const s = await getSession();
      setSession(s);
    };
    init();

    // Fetch SEO settings
    const fetchSeo = async () => {
      try {
        const { data } = await supabase
          .from("global_settings")
          .select("key, value")
          .like("key", "seo_%");
        if (data) {
          const settings: Record<string, string> = {};
          data.forEach((row: any) => { settings[row.key] = row.value; });
          setSeoSettings(settings);
        }
      } catch { /* fallback to defaults */ }
    };
    fetchSeo();
  }, []);

  const handleRecalculate = useCallback((address: string) => {
    setReturnAddress(address);
    const el = document.getElementById("estimator");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Build schema markup
  const localBusinessSchema = seoSettings.seo_schema_localbusiness === "true" ? JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "River Sand",
    "description": "Same-day river sand delivery in Greater New Orleans",
    "url": seoSettings.seo_canonical || "https://riversand.net/",
    "telephone": "1-855-GOT-WAYS",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "New Orleans",
      "addressRegion": "LA",
      "addressCountry": "US"
    },
    "areaServed": "Greater New Orleans",
    "priceRange": "$$"
  }) : null;

  const productSchema = seoSettings.seo_schema_product === "true" ? JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "River Sand — 9 Cubic Yards",
    "description": "Natural Mississippi River sand delivered same-day",
    "offers": {
      "@type": "Offer",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock",
      "areaServed": "Greater New Orleans"
    }
  }) : null;

  return (
    <div className="min-h-screen pb-14 lg:pb-0">
      <Helmet>
        {seoSettings.seo_meta_title && <title>{seoSettings.seo_meta_title}</title>}
        {seoSettings.seo_meta_description && <meta name="description" content={seoSettings.seo_meta_description} />}
        {seoSettings.seo_robots && <meta name="robots" content={seoSettings.seo_robots} />}
        {seoSettings.seo_canonical && <link rel="canonical" href={seoSettings.seo_canonical} />}
        {seoSettings.seo_og_title && <meta property="og:title" content={seoSettings.seo_og_title} />}
        {seoSettings.seo_og_description && <meta property="og:description" content={seoSettings.seo_og_description} />}
        {seoSettings.seo_og_image && <meta property="og:image" content={seoSettings.seo_og_image} />}
        {seoSettings.seo_gsc_id && <meta name="google-site-verification" content={seoSettings.seo_gsc_id} />}
        {seoSettings.seo_ga4_id && (
          <script async src={`https://www.googletagmanager.com/gtag/js?id=${seoSettings.seo_ga4_id}`} />
        )}
        {seoSettings.seo_ga4_id && (
          <script>{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${seoSettings.seo_ga4_id}');`}</script>
        )}
      </Helmet>
      {localBusinessSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: localBusinessSchema }} />
      )}
      {productSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productSchema }} />
      )}
      <Navbar />
      <ReturnVisitorBanner session={session} onRecalculate={handleRecalculate} />
      <Hero />
      <Stats />
      <DeliveryEstimator prefillAddress={returnAddress} />
      <About />
      <RiverSandInfo />
      <Features />
      <Testimonials />
      <CTA />
      <FAQ />
      <ContactForm />
      <Footer />
      <MobilePhoneBar />
      <ScrollToTop />
      <WhatsAppButton />
    </div>
  );
};

export default Index;
