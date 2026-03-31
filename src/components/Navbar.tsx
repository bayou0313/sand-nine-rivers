import { Phone, Menu, X, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = ["Pricing", "How It Works", "Why Us", "About", "FAQ", "Learn More", "Contact"];

const Navbar = ({ solid = false, logoHref = "/" }: { solid?: boolean; logoHref?: string }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(solid);

  useEffect(() => {
    const onScroll = () => setScrolled(solid || window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [solid]);

  return (
    <motion.nav
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-primary/90 backdrop-blur-md shadow-lg"
          : "bg-primary/60 backdrop-blur-sm shadow-sm"
      }`}
    >
      <div className="container mx-auto flex items-center justify-between h-16 md:h-20 px-4 md:px-0">
        <motion.a
          href={logoHref}
          className="flex items-center shrink-0"
          whileHover={{ scale: 1.04 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <img
            src="/lovable-uploads/riversand-logo_WHITE-2.png"
            alt="RiverSand logo"
            className="h-[67px] lg:h-[80px] w-auto max-w-none object-contain transition-all duration-500"
          />
        </motion.a>

        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((item) => (
            <a
              key={item}
              href={`#${item === "Why Us" ? "why-us" : item === "How It Works" ? "how-it-works" : item === "Learn More" ? "learn-more" : item.toLowerCase()}`}
              className={`font-body text-sm transition-colors duration-300 hover:text-accent ${
                scrolled ? "text-primary-foreground/90" : "text-primary-foreground/70"
              }`}
            >
              {item}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <Button size="sm" className="font-display tracking-wider bg-accent hover:bg-accent/80 text-accent-foreground rounded-lg" asChild>
              <Link to="/order">
                <ShoppingCart className="w-4 h-4 mr-1" />
                ORDER NOW
              </Link>
            </Button>
          </div>

          <div className="hidden lg:block">
            <Button size="sm" variant="outline" className="font-display tracking-wider rounded-lg border-accent/30 text-accent-foreground bg-accent hover:bg-accent/80" asChild>
              <a href="tel:+18554689297">
                <Phone className="w-4 h-4 mr-1" />
                1-855-GOT-WAYS
              </a>
            </Button>
          </div>

          <button
            className="lg:hidden transition-colors text-primary-foreground hover:text-accent"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="lg:hidden bg-primary/95 backdrop-blur-md border-t border-primary-foreground/10 px-6 py-4 space-y-3 shadow-xl overflow-hidden"
          >
            {navLinks.map((item, i) => (
              <motion.a
                key={item}
                href={`#${item === "Why Us" ? "why-us" : item === "How It Works" ? "how-it-works" : item === "Learn More" ? "learn-more" : item.toLowerCase()}`}
                className="block font-body text-sm text-primary-foreground/70 hover:text-accent transition-colors"
                onClick={() => setMenuOpen(false)}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3 }}
                whileHover={{ x: 6 }}
              >
                {item}
              </motion.a>
            ))}
            <div className="flex flex-col gap-2 pt-2">
              <Button size="sm" className="font-display tracking-wider w-full bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg" asChild>
                <Link to="/order" onClick={() => setMenuOpen(false)}>
                  <ShoppingCart className="w-4 h-4 mr-1" /> ORDER NOW
                </Link>
              </Button>
              <Button size="sm" variant="outline" className="font-display tracking-wider w-full rounded-lg" asChild>
                <a href="tel:+18554689297">
                  <Phone className="w-4 h-4 mr-1" /> 1-855-GOT-WAYS
                </a>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;