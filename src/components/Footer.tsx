import { useState, useEffect } from "react";
import { Phone, Mail, MapPin, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import logoImg from "@/assets/riversand-logo.png";
import { supabase } from "@/integrations/supabase/client";

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
}

const Footer = () => {
  const [cityLinks, setCityLinks] = useState<CityLink[]>([]);

  useEffect(() => {
    const fetchCities = async () => {
      const { data } = await supabase
        .from("city_pages")
        .select("city_slug, city_name, region")
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

  // Sort region keys, putting "Other Areas" last
  const regionKeys = Object.keys(grouped).sort((a, b) => {
    if (a === "Other Areas") return 1;
    if (b === "Other Areas") return -1;
    return a.localeCompare(b);
  });

  return (
    <footer className="bg-foreground pt-8">
      <div className="container mx-auto px-6 pb-[23px]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          <motion.div
            className="flex flex-col justify-start"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            custom={0}
            variants={fadeUp}
          >
            <motion.img
              src={logoImg}
              alt="RiverSand logo"
              className="w-[200px] h-auto object-contain mb-4 self-start"
              loading="lazy"
              whileHover={{ scale: 1.08, filter: "drop-shadow(0 0 12px hsl(41 83% 53% / 0.5))" }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            />
            <p className="font-body text-background/40 text-xs mt-2">
              River Sand is a brand of Ways Materials, LLC
            </p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} custom={1} variants={fadeUp}>
            <p className="font-display text-lg text-background tracking-widest mb-4">CONTACT</p>
            <div className="space-y-3 font-body text-sm text-background/40">
              <motion.a href="tel:+18554689297" className="flex items-center gap-2 hover:text-accent transition-colors duration-300" whileHover={{ x: 4 }}>
                <Phone className="w-4 h-4" /> 1-855-GOT-WAYS
              </motion.a>
              <motion.a href="mailto:orders@ways.us" className="flex items-center gap-2 hover:text-accent transition-colors duration-300" whileHover={{ x: 4 }}>
                <Mail className="w-4 h-4" /> orders@ways.us
              </motion.a>
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Greater New Orleans, LA
              </p>
            </div>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} custom={2} variants={fadeUp}>
            <p className="font-display text-lg text-background tracking-widest mb-4">QUICK LINKS</p>
            <div className="space-y-3 font-body text-sm text-background/40">
              {["Pricing", "Get Estimate", "About Us", "FAQ", "Contact"].map((item) => (
                <motion.a
                  key={item}
                  href={`#${item === "Get Estimate" ? "estimator" : item === "About Us" ? "about" : item.toLowerCase()}`}
                  className="block hover:text-accent transition-colors duration-300"
                  whileHover={{ x: 4 }}
                >
                  {item}
                </motion.a>
              ))}
            </div>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} custom={3} variants={fadeUp}>
            <p className="font-display text-lg text-background tracking-widest mb-4">ORDER</p>
            <div className="space-y-3 font-body text-sm text-background/40">
              <motion.div whileHover={{ x: 4 }}>
                <Link to="/order" className="flex items-center gap-2 hover:text-accent transition-colors duration-300">
                  <ShoppingCart className="w-4 h-4" /> Order Online
                </Link>
              </motion.div>
              <p>Mon–Fri + Saturday (+surcharge)</p>
              <p>Same-day before 10 AM CT</p>
              <p>Licensed & Insured</p>
            </div>
          </motion.div>
        </div>

        {/* Region-grouped city links */}
        {cityLinks.length > 0 && (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            custom={4}
            variants={fadeUp}
            className="mb-10 pt-8 border-t border-background/10"
          >
            <p className="font-display text-lg text-background tracking-widest mb-6">CITIES WE SERVE</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
              {regionKeys.map((region) => (
                <div key={region}>
                  <p className="font-display text-xs text-background/50 uppercase tracking-wider mb-2">{region}</p>
                  <div className="space-y-1.5">
                    {grouped[region].map((city) => (
                      <Link
                        key={city.city_slug}
                        to={`/${city.city_slug}/river-sand-delivery`}
                        className="block font-body text-sm text-background/40 hover:text-accent hover:underline transition-colors duration-300"
                      >
                        {city.city_name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div
          className="border-t border-background/10 pt-8 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <p className="font-body text-background/30 text-sm">
            © {new Date().getFullYear()} Ways Materials, LLC. All rights reserved.
          </p>
        </motion.div>
      </div>
    </footer>
  );
};

export default Footer;
