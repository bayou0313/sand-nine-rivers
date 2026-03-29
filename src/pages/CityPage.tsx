import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import DeliveryEstimator from "@/components/DeliveryEstimator";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Phone, Truck, MapPin, Loader2 } from "lucide-react";

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

      // Increment views via RPC
      try {
        await supabase.rpc("increment_city_page_views" as any, { p_slug: citySlug });
      } catch { /* ignore */ }

      // Fetch other cities for internal links
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
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://riversand.net/" },
      { "@type": "ListItem", "position": 2, "name": cityPage.city_name, "item": canonicalUrl },
      { "@type": "ListItem", "position": 3, "name": "River Sand Delivery", "item": canonicalUrl },
    ],
  });

  const localBusinessSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "River Sand",
    "description": `Same-day river sand delivery in ${cityPage.city_name}, ${cityPage.state}`,
    "url": canonicalUrl,
    "telephone": "1-855-GOT-WAYS",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": cityPage.city_name,
      "addressRegion": cityPage.state,
      "addressCountry": "US",
    },
    "areaServed": `${cityPage.city_name}, ${cityPage.state}`,
    "priceRange": "$$",
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

      <Navbar solid />

      {/* Hero */}
      <section className="relative bg-foreground pt-24 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70" />
        <div className="relative z-10 container mx-auto px-6">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 text-accent text-sm font-display tracking-wider">
              <MapPin className="w-4 h-4" />
              Serving {cityPage.city_name} and surrounding areas
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl leading-tight text-primary-foreground tracking-wide">
              {cityPage.h1_text || `Same-Day River Sand Delivery in ${cityPage.city_name}`}
            </h1>
            <div className="w-24 h-1 bg-accent rounded-full" />
            {cityPage.base_price && (
              <p className="text-lg text-accent font-display">
                Delivering to {cityPage.city_name} from ${Number(cityPage.base_price).toFixed(2)}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button size="lg" className="text-lg font-display tracking-wider px-10 py-6 bg-accent hover:bg-accent/90 text-accent-foreground rounded-2xl" asChild>
                <Link to="/order">
                  <Truck className="w-5 h-5 mr-2" />
                  ORDER ONLINE
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="text-lg font-display tracking-wider px-10 py-6 border-primary-foreground/50 text-primary-foreground bg-primary-foreground/10 hover:bg-primary-foreground/20 rounded-2xl" asChild>
                <a href="tel:+18554689297">
                  <Phone className="w-5 h-5 mr-2" />
                  1-855-GOT-WAYS
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Delivery Estimator */}
      <DeliveryEstimator />

      {/* AI-generated content */}
      {cityPage.content && (
        <section className="py-16 bg-background">
          <div className="container mx-auto px-6 max-w-4xl prose prose-lg prose-headings:text-foreground prose-headings:font-display prose-p:text-muted-foreground prose-li:text-muted-foreground prose-a:text-accent">
            <div dangerouslySetInnerHTML={{ __html: cityPage.content }} />
          </div>
        </section>
      )}

      {/* Other Areas We Serve */}
      {otherCities.length > 0 && (
        <section className="py-12 bg-muted">
          <div className="container mx-auto px-6">
            <h2 className="text-2xl font-display text-foreground tracking-wide mb-6">
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

      {/* CTA */}
      <section className="py-16 bg-foreground">
        <div className="container mx-auto px-6 text-center space-y-6">
          <h2 className="text-3xl font-display text-primary-foreground tracking-wide">
            Ready to Order?
          </h2>
          <p className="text-primary-foreground/60 max-w-lg mx-auto">
            Get your exact delivery price instantly. River sand dispatched same day in {cityPage.city_name}.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg font-display tracking-wider px-10 py-6 bg-accent hover:bg-accent/90 text-accent-foreground rounded-2xl" asChild>
              <Link to="/order">ORDER NOW</Link>
            </Button>
            <Button size="lg" variant="outline" className="text-lg font-display tracking-wider px-10 py-6 border-primary-foreground/50 text-primary-foreground rounded-2xl" asChild>
              <a href="tel:+18554689297">CALL 1-855-GOT-WAYS</a>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default CityPage;
