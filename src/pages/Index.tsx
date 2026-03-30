import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import SocialProofStrip from "@/components/SocialProofStrip";
import Features from "@/components/Features";
import Testimonials from "@/components/Testimonials";
import CTA from "@/components/CTA";
import Pricing from "@/components/Pricing";
import FAQ from "@/components/FAQ";
import RiverSandInfo from "@/components/RiverSandInfo";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";
import MobilePhoneBar from "@/components/MobilePhoneBar";
import ScrollToTop from "@/components/ScrollToTop";
import WhatsAppButton from "@/components/WhatsAppButton";
import ReturnVisitorBanner from "@/components/ReturnVisitorBanner";
import { initSession, getSession, incrementVisitCount, updateSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_TITLE = "Same-Day River Sand Delivery | New Orleans Metro & Gulf South | River Sand";
const DEFAULT_DESCRIPTION = "Get same-day bulk river sand delivered anywhere in the Gulf South. Instant price quote by address. Cash or card accepted. Order online in minutes.";

const localBusinessJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "River Sand",
  "url": "https://riversand.net",
  "telephone": "+18554689297",
  "description": "Same-day bulk river sand delivery serving the Gulf South region. Instant price quotes, cash or card payment.",
  "areaServed": {
    "@type": "GeoCircle",
    "geoMidpoint": {
      "@type": "GeoCoordinates",
      "latitude": 29.95,
      "longitude": -90.07,
    },
    "geoRadius": "80000",
  },
  "priceRange": "$$",
  "paymentAccepted": "Cash, Credit Card",
  "openingHours": "Mo-Sa 07:00-17:00",
});

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

  const faqSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "How quickly can you deliver river sand?",
        "acceptedAnswer": { "@type": "Answer", "text": "Same-day delivery for orders placed before noon, Monday through Saturday." }
      },
      {
        "@type": "Question",
        "name": "What areas do you serve?",
        "acceptedAnswer": { "@type": "Answer", "text": "We serve the greater Gulf South region including Metairie, Kenner, Gretna, and surrounding areas." }
      },
      {
        "@type": "Question",
        "name": "Can I pay with cash?",
        "acceptedAnswer": { "@type": "Answer", "text": "Yes. We offer cash on delivery (COD) at no extra charge. You can also pay by card online." }
      },
    ]
  });

  return (
    <div className="min-h-screen pb-14 lg:pb-0">
      <Helmet>
        <title>{seoSettings.seo_meta_title || DEFAULT_TITLE}</title>
        <meta name="description" content={seoSettings.seo_meta_description || DEFAULT_DESCRIPTION} />
        {seoSettings.seo_robots && <meta name="robots" content={seoSettings.seo_robots} />}
        <link rel="canonical" href={seoSettings.seo_canonical || "https://riversand.net/"} />
        {seoSettings.seo_og_title && <meta property="og:title" content={seoSettings.seo_og_title} />}
        {seoSettings.seo_og_description && <meta property="og:description" content={seoSettings.seo_og_description} />}
        {seoSettings.seo_og_image && <meta property="og:image" content={seoSettings.seo_og_image} />}
        {seoSettings.seo_gsc_id && <meta name="google-site-verification" content={seoSettings.seo_gsc_id} />}
        <script type="application/ld+json">{localBusinessJsonLd}</script>
        <script type="application/ld+json">{faqSchema}</script>
        {productSchema && <script type="application/ld+json">{productSchema}</script>}
      </Helmet>
      <Navbar />
      <ReturnVisitorBanner session={session} onRecalculate={handleRecalculate} />
      <Hero prefillAddress={returnAddress} />
      <SocialProofStrip />
      <Features />
      <Testimonials />
      <CTA />
      <Pricing />
      <FAQ />
      <RiverSandInfo />
      <ContactForm />
      <Footer />
      <MobilePhoneBar />
      <ScrollToTop />
      <WhatsAppButton />
    </div>
  );
};

export default Index;
