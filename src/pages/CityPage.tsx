import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import { updateSession, initSession } from "@/lib/session";
import { getPaletteForSlug, deriveCssVars } from "@/lib/palettes";
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
import { MapPin, Loader2, Mail, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const cleanCityName = (name: string): string =>
  name.replace(/\s*,?\s*[Ll][Aa]$/, '').trim();

const slugToTitle = (slug: string): string => {
  return slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const parsePitAddress = (address: string) => {
  const parts = address.split(",").map(s => s.trim());
  const streetAddress = parts[0] || "";
  const addressLocality = parts[1] || "";
  const lastPart = parts[2] || "";
  const stateZipMatch = lastPart.match(/([A-Z]{2})\s+(\d{5})/);
  return {
    streetAddress,
    addressLocality,
    addressRegion: stateZipMatch?.[1] || "LA",
    postalCode: stateZipMatch?.[2] || "",
  };
};

const WaitlistPage = ({ cityPage }: { cityPage: any }) => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: {
          action: "join_waitlist",
          city_slug: cityPage.city_slug,
          city_name: cityPage.city_name,
          customer_name: name || null,
          customer_email: email,
          customer_phone: phone || null,
        },
      });
      if (error) throw error;
      setSubmitted(true);
      toast({ title: "You're on the list!", description: `We'll notify you when delivery to ${cityPage.city_name} becomes available.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const canonicalUrl = `https://riversand.net/${cityPage.city_slug}/river-sand-delivery`;

  return (
    <div className="min-h-screen pb-14 lg:pb-0">
      <Helmet>
        <title>{`River Sand Delivery Coming to ${cityPage.city_name}, ${cityPage.state} | River Sand`}</title>
        <meta name="description" content={`River sand delivery is coming to ${cityPage.city_name}, ${cityPage.state}. Join the waitlist and be the first to know when same-day delivery is available.`} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />
      </Helmet>

      <Navbar solid />

      {/* Hero Section */}
      <section className="relative py-20 md:py-28" style={{ background: "linear-gradient(135deg, #0D2137 0%, #142845 100%)" }}>
        <div className="container mx-auto px-6 max-w-2xl text-center">
          <img
            src="https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/riversand-logo_WHITE.png.png"
            alt="River Sand"
            title="River Sand Delivery — RiverSand.net"
            className="h-10 mx-auto mb-8 opacity-80"
          />
          <h1 className="text-2xl md:text-4xl font-display text-white tracking-wide mb-6">
            River Sand Delivery Coming to{" "}
            <span style={{ color: "#C07A00" }}>{cityPage.city_name}</span>
          </h1>
          <p className="text-base md:text-lg text-gray-300 leading-relaxed mb-10 max-w-lg mx-auto">
            We're expanding our delivery area. Join the waitlist and be the first to know when same-day river sand delivery is available in {cityPage.city_name}.
          </p>

          {submitted ? (
            <div className="bg-green-900/30 border border-green-500/40 rounded-xl p-6">
              <p className="text-green-300 font-display text-lg">You're on the list!</p>
              <p className="text-green-400/80 text-sm mt-2">We'll email you as soon as delivery to {cityPage.city_name} becomes available.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 max-w-sm mx-auto">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Name (optional)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                />
              </div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="email"
                  placeholder="Email (required)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-gray-400"
                />
              </div>
              <Button
                type="submit"
                disabled={submitting || !email}
                className="w-full font-display tracking-wider text-sm"
                style={{ backgroundColor: "#C07A00", color: "#fff" }}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                JOIN WAITLIST
              </Button>
            </form>
          )}

          <div className="mt-10 pt-8 border-t border-white/10">
            <p className="text-gray-400 text-sm mb-3">Already serving nearby areas — check if we deliver to you:</p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 font-display text-sm tracking-wider"
              style={{ color: "#C07A00" }}
            >
              GET MY PRICE →
            </Link>
          </div>
        </div>
      </section>

      <Footer />
      <MobilePhoneBar />
    </div>
  );
};

const CityPage = () => {
  const { citySlug } = useParams<{ citySlug: string }>();
  const navigate = useNavigate();
  const FALLBACK_PRODUCT_IMAGE = "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/river-sand-product-new-orleans.jpg";
  const [cityPage, setCityPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [otherCities, setOtherCities] = useState<any[]>([]);
  const [isWaitlist, setIsWaitlist] = useState(false);
  const [productImageUrl, setProductImageUrl] = useState(FALLBACK_PRODUCT_IMAGE);

  useEffect(() => {
    if (!citySlug) { navigate("/"); return; }

    const fetchPage = async () => {
      setLoading(true);
      // Try active first, then waitlist
      const { data, error } = await supabase
        .from("city_pages")
        .select("*, pits(name, address)")
        .eq("city_slug", citySlug)
        .in("status", ["active", "waitlist"])
        .maybeSingle();

      if (error || !data) {
        navigate("/");
        return;
      }

      data.city_name = cleanCityName(data.city_name);
      setCityPage(data);
      setIsWaitlist(data.status === "waitlist");

      trackEvent("city_page_view", {
        city_name: data.city_name,
        state: data.state,
        page_price: data.base_price,
        is_waitlist: data.status === "waitlist",
      });

      // Track session entry from city page
      await initSession();
      await updateSession({
        stage: "visited",
        entry_page: `/${data.city_slug}/river-sand-delivery`,
        entry_city_page: data.city_slug,
        entry_city_name: data.city_name,
      });

      if (data.status === "active") {
        try {
          await supabase.rpc("increment_city_page_views" as any, { p_slug: citySlug });
        } catch { /* ignore */ }
      }

      const [{ data: others }, { data: imgSetting }] = await Promise.all([
        supabase
          .from("city_pages")
          .select("city_name, city_slug, state")
          .eq("status", "active")
          .neq("city_slug", citySlug)
          .limit(5),
        supabase
          .from("global_settings")
          .select("value")
          .eq("key", "product_image_url")
          .maybeSingle(),
      ]);
      if (others) setOtherCities(others);
      if (imgSetting?.value) setProductImageUrl(imgSetting.value);

      setLoading(false);
    };

    fetchPage();
  }, [citySlug, navigate]);

  // Apply per-city palette and clean up on unmount
  useEffect(() => {
    if (!citySlug) return;
    const palette = getPaletteForSlug(citySlug);
    const vars = deriveCssVars(palette);
    const root = document.documentElement;
    const keys = Object.keys(vars);
    keys.forEach(prop => root.style.setProperty(prop, vars[prop]));
    return () => { keys.forEach(prop => root.style.removeProperty(prop)); };
  }, [citySlug]);

  if (loading) {
    const cityName = slugToTitle(citySlug || "");
    const defaultTitle = `River Sand Delivery in ${cityName}, LA | Same-Day | River Sand`;
    const defaultDesc = `Same-day bulk river sand delivery to ${cityName}, Louisiana. Instant online pricing, cash or card, order before noon for same-day service.`;
    const defaultCanonical = `https://riversand.net/${citySlug}/river-sand-delivery`;
    return (
      <>
        <Helmet>
          <title>{defaultTitle}</title>
          <meta name="description" content={defaultDesc} />
          <link rel="canonical" href={defaultCanonical} />
          <meta property="og:title" content={defaultTitle} />
          <meta property="og:description" content={defaultDesc} />
          <meta property="og:url" content={defaultCanonical} />
        </Helmet>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </>
    );
  }

  if (!cityPage) return null;

  // Show waitlist page if status is waitlist
  if (isWaitlist) {
    return <WaitlistPage cityPage={cityPage} />;
  }

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

  const pitData = cityPage.pits as { name: string; address: string } | null;
  const parsedAddr = pitData?.address ? parsePitAddress(pitData.address) : null;

  const localBusinessSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: `River Sand — ${cityPage.city_name}`,
    url: canonicalUrl,
    telephone: "+18554689297",
    description: cityPage.meta_description || `Same-day river sand delivery in ${cityPage.city_name}, ${cityPage.state}`,
    image: "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/riversand-logo_BLACK.png.png",
    priceRange: "$$",
    paymentAccepted: "Cash, Credit Card",
    currenciesAccepted: "USD",
    openingHours: "Mo-Sa 07:00-17:00",
    address: parsedAddr
      ? {
          "@type": "PostalAddress",
          streetAddress: parsedAddr.streetAddress,
          addressLocality: parsedAddr.addressLocality,
          addressRegion: parsedAddr.addressRegion,
          postalCode: parsedAddr.postalCode,
          addressCountry: "US",
        }
      : {
          "@type": "PostalAddress",
          addressLocality: cityPage.city_name,
          addressRegion: cityPage.state || "LA",
          addressCountry: "US",
        },
    areaServed: {
      "@type": "City",
      name: cityPage.city_name,
      containedInPlace: {
        "@type": "AdministrativeArea",
        name: cityPage.region ?? cityPage.state,
      },
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "River Sand Delivery Services",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: `River Sand Delivery in ${cityPage.city_name}`,
            description: `Same-day bulk river sand delivery to ${cityPage.city_name}, ${cityPage.state}. 9 cubic yards per load.`,
            image: "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/riversand-logo_BLACK.png.png",
          },
          ...(cityPage.base_price
            ? {
                price: Number(cityPage.base_price).toFixed(2),
                priceCurrency: "USD",
              }
            : {}),
          image: "https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/riversand-logo_BLACK.png.png",
          availability: "https://schema.org/InStock",
          areaServed: {
            "@type": "City",
            name: cityPage.city_name,
          },
          hasMerchantReturnPolicy: {
            "@type": "MerchantReturnPolicy",
            applicableCountry: "US",
            returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
          },
          shippingDetails: {
            "@type": "OfferShippingDetails",
            shippingRate: { "@type": "MonetaryAmount", value: "0", currency: "USD" },
            shippingDestination: { "@type": "DefinedRegion", addressCountry: "US" },
          },
        },
      ],
    },
  });

  const productSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: `River Sand Delivery in ${cityPage.city_name}`,
    description: `Same-day river sand delivery in ${cityPage.city_name}, ${cityPage.state}. 9 cubic yards per load.`,
    image: {
      "@type": "ImageObject",
      url: productImageUrl,
      description: `River sand delivery in ${cityPage.city_name}, Louisiana`,
    },
    brand: { "@type": "Brand", name: "River Sand" },
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      ...(cityPage.base_price ? { price: Number(cityPage.base_price) } : {}),
      availability: "https://schema.org/InStock",
      areaServed: { "@type": "City", name: cityPage.city_name, addressRegion: cityPage.state || "LA" },
    },
  });

  return (
    <div className="min-h-screen pb-14 lg:pb-0">
      <Helmet>
        {cityPage.meta_title && <title>{cityPage.meta_title}</title>}
        {cityPage.meta_description && <meta name="description" content={cityPage.meta_description} />}
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={cityPage.meta_title || `River Sand Delivery in ${cityPage.city_name}`} />
        <meta property="og:description" content={cityPage.meta_description || ""} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={productImageUrl} />
      </Helmet>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: localBusinessSchema }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productSchema }} />

      <Navbar solid logoHref={`/${cityPage.city_slug}/river-sand-delivery`} activeSections={["why-us", "about", "faq", "learn-more", "contact"]} />
      <Hero
        h1Override={cityPage.h1_text || `River Sand Delivery in ${cityPage.city_name}, ${cityPage.state} — Same-Day Service`}
        subtitleOverride={
          cityPage.hero_intro
            ? cityPage.hero_intro.length > 130
              ? cityPage.hero_intro.slice(0, 127) + "..."
              : cityPage.hero_intro
            : `Same-day bulk river sand delivery to ${cityPage.city_name}, ${cityPage.state}.`
        }
        showEstimator={true}
        
      />

      {/* Conditional price display for multi-PIT vs single-PIT cities */}
      {cityPage.multi_pit_coverage ? (
        <div className="text-center py-5 bg-primary/5 border-b border-border/50">
          <p className="text-sm font-body text-muted-foreground max-w-lg mx-auto px-4">
            Pricing varies by location within {cityPage.city_name}. Enter your address above for your exact delivery price.
          </p>
        </div>
      ) : cityPage.base_price ? (
        <div className="text-center py-5 bg-primary/5 border-b border-border/50">
          <p className="font-display text-2xl text-foreground tracking-wide">
            Starting at <span className="text-accent">${Number(cityPage.base_price).toFixed(0)}</span>
          </p>
          <p className="text-xs font-body text-muted-foreground mt-1">
            per 9 cu yd load · Enter your address above for your exact price
          </p>
        </div>
      ) : null}

      <Stats />
      <About cityName={cityPage.city_name} />
      <RiverSandInfo />
      <Features />
      <Testimonials />

      {/* Other Areas We Serve */}
      {otherCities.length > 0 && (
        <section className="py-12 bg-muted/50">
          <div className="container mx-auto px-6">
             <h2 className="text-2xl md:text-3xl font-display text-foreground tracking-wide mb-6">
              Other Areas We Serve Near {cityPage.city_name}
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

      <CTA cityName={cityPage.city_name} />
      <FAQ cityName={cityPage.city_name} />
      <ContactForm cityName={cityPage.city_name} />
      <Footer />
      <MobilePhoneBar />
      <ScrollToTop />
      <WhatsAppButton />
    </div>
  );
};

export default CityPage;
