import { useState, useEffect, useCallback, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import SocialProofStrip from "@/components/SocialProofStrip";
import About from "@/components/About";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
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
import { useBrandPalette } from "@/hooks/useBrandPalette";

const FALLBACK_LOW = "195.00";
const FALLBACK_HIGH = "231.00";
const FALLBACK_COUNT = "32";

const faqSchema = {
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
};

const DEFAULT_TITLE = "Same-Day River Sand Delivery | New Orleans Metro & Gulf South | River Sand";
const DEFAULT_DESCRIPTION = "Get same-day bulk river sand delivered anywhere in the Gulf South. Instant price quote by address. Cash or card accepted. Order online in minutes.";
const DEFAULT_H1 = "Same-Day River Sand Delivery";

const Index = () => {
  useBrandPalette();
  const [session, setSession] = useState<any>(null);
  const [returnAddress, setReturnAddress] = useState<string | null>(null);
  const [seo, setSeo] = useState<Record<string, string>>({});
  const [priceRange, setPriceRange] = useState({ low: FALLBACK_LOW, high: FALLBACK_HIGH, count: FALLBACK_COUNT });

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
          setSeo(settings);
        }
      } catch { /* fallback to defaults */ }
    };
    fetchSeo();

    const fetchPriceRange = async () => {
      try {
        const { data } = await supabase
          .from("city_pages")
          .select("base_price")
          .eq("status", "active")
          .not("base_price", "is", null);
        if (data && data.length > 0) {
          const prices = data.map((r: any) => Number(r.base_price));
          setPriceRange({
            low: Math.min(...prices).toFixed(2),
            high: Math.max(...prices).toFixed(2),
            count: String(prices.length),
          });
        }
      } catch { /* fallback to defaults */ }
    };
    fetchPriceRange();
  }, []);

  useEffect(() => {
    const gtmId = seo?.seo_gtm_id || "";
    if (!gtmId) return;
    if (document.querySelector(`script[data-gtm="${gtmId}"]`)) return;
    const script = document.createElement("script");
    script.setAttribute("data-gtm", gtmId);
    script.innerHTML = `
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;
      j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
      f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${gtmId}');
    `;
    document.head.appendChild(script);
  }, [seo?.seo_gtm_id]);

  const localBusinessJsonLd = useMemo(() => ({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "River Sand",
    "url": "https://riversand.net",
    "telephone": "+18554689297",
    "description": "Same-day bulk river sand delivery serving the Gulf South region. Instant price quotes, cash or card payment.",
    "image": "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/riversand-logo_BLACK.png.png",
    "priceRange": "$$",
    "paymentAccepted": "Cash, Credit Card",
    "currenciesAccepted": "USD",
    "openingHours": "Mo-Sa 07:00-17:00",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "2429 Tifton St",
      "addressLocality": "Kenner",
      "addressRegion": "LA",
      "postalCode": "70062",
      "addressCountry": "US",
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 29.95,
      "longitude": -90.07,
    },
    "areaServed": {
      "@type": "GeoCircle",
      "geoMidpoint": {
        "@type": "GeoCoordinates",
        "latitude": 29.95,
        "longitude": -90.07,
      },
      "geoRadius": "80000",
    },
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "River Sand Delivery Services",
      "itemListElement": [
        {
          "@type": "AggregateOffer",
          "itemOffered": {
            "@type": "Service",
            "name": "Bulk River Sand Delivery",
            "description": "Same-day delivery of 9 cubic yards of river sand. Ideal for drainage, landscaping, fill, and construction projects.",
          },
          "lowPrice": priceRange.low,
          "highPrice": priceRange.high,
          "priceCurrency": "USD",
          "offerCount": priceRange.count,
          "priceValidUntil": "2027-12-31",
          "availability": "https://schema.org/InStock",
          "hasMerchantReturnPolicy": {
            "@type": "MerchantReturnPolicy",
            "applicableCountry": "US",
            "returnPolicyCategory": "https://schema.org/MerchantReturnNotPermitted",
            "merchantReturnDays": 0,
            "returnMethod": "https://schema.org/ReturnNotSupported",
            "returnFees": "https://schema.org/FreeReturn",
          },
          "shippingDetails": {
            "@type": "OfferShippingDetails",
            "shippingRate": { "@type": "MonetaryAmount", "value": "0", "currency": "USD" },
            "shippingDestination": { "@type": "DefinedRegion", "addressCountry": "US", "addressRegion": "LA" },
            "deliveryTime": {
              "@type": "ShippingDeliveryTime",
              "handlingTime": { "@type": "QuantitativeValue", "minValue": 0, "maxValue": 4 },
              "transitTime": { "@type": "QuantitativeValue", "minValue": 0, "maxValue": 4 },
            },
          },
        },
      ],
    },
    "sameAs": [
      "https://riversand.net",
    ],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "reviewCount": "127",
      "bestRating": "5",
      "worstRating": "1",
    },
    "review": [
      {
        "@type": "Review",
        "reviewRating": { "@type": "Rating", "ratingValue": "5", "bestRating": "5" },
        "author": { "@type": "Person", "name": "James R." },
        "reviewBody": "Ordered at 9 AM and the load was in my driveway by noon. Exactly what I needed for my drainage project.",
      },
      {
        "@type": "Review",
        "reviewRating": { "@type": "Rating", "ratingValue": "5", "bestRating": "5" },
        "author": { "@type": "Person", "name": "Danielle F." },
        "reviewBody": "Easiest way to get sand delivered. Typed my address, saw the price, paid online. Driver was on time and professional.",
      },
      {
        "@type": "Review",
        "reviewRating": { "@type": "Rating", "ratingValue": "5", "bestRating": "5" },
        "author": { "@type": "Person", "name": "Carlos M." },
        "reviewBody": "Used them twice now for fill work in the backyard. Fair price and they actually show up when they say they will.",
      },
    ],
  }), [priceRange]);

  const handleRecalculate = useCallback((address: string) => {
    setReturnAddress(address);
    const el = document.getElementById("estimator");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => {
        const input = el.querySelector("input") as HTMLInputElement | null;
        input?.focus({ preventScroll: true });
      }, 500);
    }
  }, []);

  return (
    <div className="min-h-screen pb-14 lg:pb-0">
      <Helmet>
        <title>{seo.seo_meta_title || DEFAULT_TITLE}</title>
        <meta name="description" content={seo.seo_meta_description || DEFAULT_DESCRIPTION} />
        <meta name="robots" content={seo.seo_robots || "index, follow"} />
        <link rel="canonical" href={seo.seo_canonical || "https://riversand.net/"} />
        {seo.seo_og_title && <meta property="og:title" content={seo.seo_og_title} />}
        {seo.seo_og_description && <meta property="og:description" content={seo.seo_og_description} />}
        <meta property="og:image" content={seo.seo_og_image || "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/river-sand-product-new-orleans.jpg"} />
        {seo.seo_gsc_id && <meta name="google-site-verification" content={seo.seo_gsc_id} />}
        {seo.seo_schema_localbusiness !== "false" && (
          <script type="application/ld+json">{JSON.stringify(localBusinessJsonLd)}</script>
        )}
        {seo.seo_schema_faq !== "false" && (
          <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
        )}
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "River Sand Delivery",
          "url": "https://riversand.net",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://riversand.net/order?address={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        })}</script>
      </Helmet>
      <Navbar />
      <ReturnVisitorBanner session={session} onRecalculate={handleRecalculate} />
      <Hero h1Override={seo.seo_h1 || DEFAULT_H1} prefillAddress={returnAddress} />
      <SocialProofStrip />
      <HowItWorks />
      <About />
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
