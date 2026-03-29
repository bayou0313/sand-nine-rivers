import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
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
import { MapPin, ShieldCheck, Truck, Loader2 } from "lucide-react";

const CityPage = () => {
  const { citySlug } = useParams<{ citySlug: string }>();
  const navigate = useNavigate();
  const [cityPage, setCityPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [otherCities, setOtherCities] = useState<any[]>([]);

  useEffect(() => {
    if (!citySlug) { navigate("/"); return; }

    const fetchPage = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("city_pages")
        .select("*")
        .eq("city_slug", citySlug)
        .eq("status", "active")
        .maybeSingle();

      if (error || !data) {
        navigate("/");
        return;
      }

      setCityPage(data);

      // Increment views
      try {
        await supabase.rpc("increment_city_page_views" as any, { p_slug: citySlug });
      } catch { /* ignore */ }

      // Other cities for internal links
      const { data: others } = await supabase
        .from("city_pages")
        .select("city_name, city_slug, state")
        .eq("status", "active")
        .neq("city_slug", citySlug)
        .limit(5);
      if (others) setOtherCities(others);

      setLoading(false);
    };

    fetchPage();
  }, [citySlug, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!cityPage) return null;

  const canonicalUrl = `https://riversand.net/${cityPage.city_slug}/river-sand-delivery`;

  const breadcrumbSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://riversand.net/" },
      { "@type": "ListItem", position: 2, name: cityPage.city_name, item: canonicalUrl },
      { "@type": "ListItem", position: 3, name: "River Sand Delivery", item: canonicalUrl },
    ],
  });

  const localBusinessSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "River Sand",
    description: `Same-day river sand delivery in ${cityPage.city_name}, ${cityPage.state}`,
    url: canonicalUrl,
    telephone: "1-855-GOT-WAYS",
    address: {
      "@type": "PostalAddress",
      addressLocality: cityPage.city_name,
      addressRegion: cityPage.state,
      addressCountry: "US",
    },
    areaServed: `${cityPage.city_name}, ${cityPage.state}`,
    priceRange: "$$",
  });

  const cityTrustBadges = [
    { icon: ShieldCheck, text: "Same-day delivery available" },
    { icon: MapPin, text: `Serving ${cityPage.city_name} area` },
    { icon: Truck, text: "Local dispatch team" },
  ];

  return (
    <div className="min-h-screen pb-14 lg:pb-0">
      <Helmet>
        {cityPage.meta_title && <title>{cityPage.meta_title}</title>}
        {cityPage.meta_description && <meta name="description" content={cityPage.meta_description} />}
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={cityPage.meta_title || `River Sand Delivery in ${cityPage.city_name}`} />
        <meta property="og:description" content={cityPage.meta_description || ""} />
        <meta property="og:url" content={canonicalUrl} />
      </Helmet>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: localBusinessSchema }} />

      <Navbar />
      <Hero
        h1Override={cityPage.h1_text || `SAME-DAY RIVER SAND DELIVERY IN ${cityPage.city_name.toUpperCase()}`}
        subtitleOverride={`Quality river sand for landscaping, drainage, backfill, and construction projects in ${cityPage.city_name}, ${cityPage.state}. Order before noon for same-day delivery.`}
        trustBadges={cityTrustBadges}
      />
      <Stats />
      <DeliveryEstimator />

      {/* City-specific AI content — styled to match homepage sections */}
      {cityPage.content && (
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-6 max-w-4xl prose prose-lg prose-headings:font-display prose-headings:tracking-wide prose-headings:text-foreground prose-p:text-muted-foreground prose-p:leading-relaxed prose-li:text-muted-foreground prose-a:text-accent prose-h2:text-2xl prose-h2:md:text-3xl prose-h3:text-xl prose-h3:md:text-2xl">
            <div dangerouslySetInnerHTML={{ __html: cityPage.content }} />
          </div>
        </section>
      )}

      <About />
      <RiverSandInfo />
      <Features />
      <Testimonials />

      {/* Other Areas We Serve */}
      {otherCities.length > 0 && (
        <section className="py-12 bg-muted/50">
          <div className="container mx-auto px-6">
            <h2 className="text-2xl md:text-3xl font-display text-foreground tracking-wide mb-6">
              Other Areas We Serve
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {otherCities.map((c) => (
                <Link
                  key={c.city_slug}
                  to={`/${c.city_slug}/river-sand-delivery`}
                  className="block p-4 bg-background rounded-xl border border-border hover:border-accent hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-accent" />
                    <span className="font-display text-foreground">{c.city_name}, {c.state}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

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

export default CityPage;
