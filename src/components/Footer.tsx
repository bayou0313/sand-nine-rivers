import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

const WAYS_LOGO_DARK = "/7d3a148e-9b8f-4684-8d6a-f6c784fa70d2.png";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

interface CityLink {
  city_slug: string;
  city_name: string;
  region: string | null;
  state: string;
}

function formatRegionHeading(region: string, state: string): string {
  const term = state?.toUpperCase() === "LA" ? "Parish" : "County";
  const lower = region.toLowerCase();
  if (lower.includes("parish") || lower.includes("county")) return region;
  return `${region} ${term}`;
}

function getCitiesSectionHeading(cities: CityLink[]): string {
  const states = [...new Set(cities.map((c) => c.state))];
  if (states.length > 1) return "AREAS WE SERVE";
  if (states[0] === "LA") return "CITIES WE SERVE";
  return "COUNTIES WE SERVE";
}

const Footer = () => {
  const [cityLinks, setCityLinks] = useState<CityLink[]>([]);

  useEffect(() => {
    const fetchCities = async () => {
      const { data } = await supabase
        .from("city_pages")
        .select("city_slug, city_name, region, state")
        .eq("status", "active")
        .order("region", { ascending: true, nullsFirst: false })
        .order("city_name", { ascending: true });
      if (data) setCityLinks(data as CityLink[]);
    };
    fetchCities();
  }, []);

  const grouped = cityLinks.reduce((acc, city) => {
    const key = city.region ?? "Other Areas";
    if (!acc[key]) acc[key] = [];
    acc[key].push(city);
    return acc;
  }, {} as Record<string, CityLink[]>);

  const regionKeys = Object.keys(grouped).sort((a, b) => {
    if (a === "Other Areas") return 1;
    if (b === "Other Areas") return -1;
    return a.localeCompare(b);
  });

  return (
    <footer>
      {/* Logo bar */}
      <div
        className="py-8"
        style={{
          backgroundColor: "#F8F6F1",
          borderBottom: cityLinks.length > 0 ? "1px solid #E8E5DC" : undefined,
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <a href="https://ways.us" target="_blank" rel="noopener noreferrer">
            <img
              src={WAYS_LOGO_DARK}
              alt="WAYS"
              className="object-contain"
              style={{ width: 164 }}
              loading="lazy"
            />
          </a>
          <p style={{ color: "#888888", fontSize: 11 }}>
            © 2026 WAYS® Materials LLC
          </p>
          <p style={{ color: "#AAAAAA", fontSize: 11 }}>
            orders@riversand.net · 1-855-GOT-WAYS
          </p>
          <p style={{ color: "#BBBBBB", fontSize: 10, fontStyle: "italic" }}>
            River Sand.  Real Sand. Real People.
          </p>
        </div>
      </div>

      {/* Cities section */}
      {cityLinks.length > 0 && (
        <div className="container mx-auto px-6 py-6 border-0 border-primary">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            custom={0}
            variants={fadeUp}
            className="rounded-xl p-6 md:px-8"
            style={{
              border: "1px solid #E8E5DC",
              backgroundColor: "#FFFFFF",
            }}
          >
            <p
              className="font-display text-xs tracking-[0.25em] uppercase mb-5 text-center"
              style={{ color: "#C07A00" }}
            >
              {getCitiesSectionHeading(cityLinks)}
            </p>
            {regionKeys.length === 1 && regionKeys[0] === "Other Areas" ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-1.5">
                {cityLinks.map((city) => (
                  <Link
                    key={city.city_slug}
                    to={`/${city.city_slug}/river-sand-delivery`}
                    className="block font-body text-sm hover:underline transition-colors duration-300"
                    style={{ color: "#555555" }}
                  >
                    {city.city_name}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-6">
                {regionKeys.map((region) => (
                  <div key={region}>
                    <p
                      className="text-xs font-semibold uppercase tracking-wide mb-2"
                      style={{ color: "#999999" }}
                    >
                      {formatRegionHeading(region, grouped[region][0]?.state || "LA")}
                    </p>
                    <div className="space-y-1.5">
                      {grouped[region].map((city) => (
                        <Link
                          key={city.city_slug}
                          to={`/${city.city_slug}/river-sand-delivery`}
                          className="block font-body text-sm hover:underline transition-colors duration-300"
                          style={{ color: "#555555" }}
                        >
                          {city.city_name}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </footer>
  );
};

export default Footer;
