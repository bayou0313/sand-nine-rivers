import { Phone, Menu, X, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";


const Navbar = ({ solid = false }: { solid?: boolean }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(solid);

  useEffect(() => {
    const onScroll = () => setScrolled(solid || window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? "bg-background/95 backdrop-blur-md border-b border-border shadow-sm" : "bg-transparent"}`}>
        <div className="container mx-auto px-6 flex items-center justify-between h-16 md:h-20">
        <a href="/" className="flex items-center shrink-0">
          <img src="/lovable-uploads/riversand-logo.png" alt="RiverSand logo" className={`h-[67px] lg:h-[80px] w-auto max-w-none object-contain transition-all duration-300 ${scrolled ? "" : "brightness-0 invert"}`} />
        </a>
        <div className="hidden lg:flex items-center gap-8">
          {["Pricing", "Get Estimate", "About", "FAQ", "Contact"].map((item) => (
            <a
              key={item}
              href={`#${item === "Get Estimate" ? "estimator" : item.toLowerCase()}`}
              className={`font-body text-sm transition-colors duration-300 hover:text-accent ${scrolled ? "text-muted-foreground" : "text-primary-foreground/70"}`}
            >
              {item}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" className="font-display tracking-wider hidden sm:inline-flex bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg shadow-md shadow-accent/20" asChild>
            <Link to="/order">
              <ShoppingCart className="w-4 h-4 mr-1" />
              ORDER NOW
            </Link>
          </Button>
          <Button size="sm" variant="outline" className={`font-display tracking-wider hidden lg:inline-flex rounded-lg ${scrolled ? "border-border text-foreground hover:bg-muted" : "border-primary-foreground/60 text-primary-foreground bg-primary-foreground/10 hover:bg-primary-foreground/20"}`} asChild>
            <a href="tel:+18554689297">
              <Phone className="w-4 h-4 mr-1" />
              1-855-GOT-WAYS
            </a>
          </Button>
          <button className={`lg:hidden transition-colors ${scrolled ? "text-foreground" : "text-primary-foreground"}`} onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="lg:hidden bg-background/95 backdrop-blur-md border-t border-border px-6 py-4 space-y-3 shadow-xl">
          {["Pricing", "Get Estimate", "About", "FAQ", "Contact"].map((item) => (
            <a
              key={item}
              href={`#${item === "Get Estimate" ? "estimator" : item.toLowerCase()}`}
              className="block font-body text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              {item}
            </a>
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
        </div>
      )}
    </nav>
  );
};

export default Navbar;
