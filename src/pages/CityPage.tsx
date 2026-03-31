import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
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
import { MapPin, Loader2 } from "lucide-react";

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

      trackEvent("city_page_view", {
        city_name: data.city_name,
        state: data.state,
        page_price: data.base_price,
      });

      try {
        await supabase.rpc("increment_city_page_views" as any, { p_slug: citySlug });
      } catch { /* ignore */ }

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
      { "@type": "ListItem", position: 1, name: "Home", item: "https://riversand.net" },
      { "@type": "ListItem", position: 2, name: "River Sand Delivery", item: "https://riversand.net" },
      { "@type": "ListItem", position: 3, name: cityPage.city_name, item: canonicalUrl },
    ],
  });

  const localBusinessSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "River Sand",
    url: canonicalUrl,
    telephone: "1-855-GOT-WAYS",
    description: cityPage.meta_description || `Same-day river sand delivery in ${cityPage.city_name}, ${cityPage.state}`,
    areaServed: {
      "@type": "City",
      name: cityPage.city_name,
      containedInPlace: {
        "@type": "AdministrativeArea",
        name: cityPage.region ?? cityPage.state,
      },
    },
    priceRange: "$$",
    paymentAccepted: "Cash, Credit Card",
    openingHours: "Mo-Sa 07:00-17:00",
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "River Sand Delivery Services",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: `River Sand Delivery in ${cityPage.city_name}`,
            description: `Same-day bulk river sand delivery to ${cityPage.city_name}, ${cityPage.state}`,
            areaServed: cityPage.city_name,
            ...(cityPage.base_price ? { price: cityPage.base_price, priceCurrency: "USD" } : {}),
          },
        },
      ],
    },
  });


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

      <Navbar solid logoHref={`/${cityPage.city_slug}/river-sand-delivery`} />
      <Hero
        h1Override={cityPage.h1_text || `River Sand Delivery in ${cityPage.city_name}, ${cityPage.state} — Same-Day Service`}
        subtitleOverride={
          cityPage.hero_intro
            ? cityPage.hero_intro.length > 130
              ? cityPage.hero_intro.slice(0, 127) + "..."
              : cityPage.hero_intro
            : `Same-day bulk river sand delivery to ${cityPage.city_name}, ${cityPage.state}.`
        }
      />

      {/* Conditional price display for multi-PIT vs single-PIT cities */}
      {cityPage.multi_pit_coverage ? (
        <div className="text-center py-4 bg-accent/10">
          <p className="text-base text-muted-foreground max-w-lg mx-auto px-4">
            Pricing varies by location within {cityPage.city_name}.
            Enter your address above for your exact delivery price.
          </p>
        </div>
      ) : cityPage.base_price ? (
        <div className="text-center py-4 bg-accent/10">
          <p className="text-2xl font-semibold text-foreground">
            Delivery from ${Number(cityPage.base_price).toFixed(0)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your address above for your exact price
          </p>
        </div>
      ) : null}

      <Stats />
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
                    <span className="font-display text-foreground">River Sand Delivery in {c.city_name}, {c.state}</span>
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
