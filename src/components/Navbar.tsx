import { Phone, Menu, X, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/95 backdrop-blur-sm border-b border-border shadow-sm" : "bg-transparent"}`}>
      <div className="container mx-auto px-6 flex items-center justify-between h-16">
        <a href="/" className={`text-3xl font-display tracking-wider transition-colors ${scrolled ? "text-primary" : "text-primary-foreground"}`}>
          RIVERSAND
        </a>
        <div className="hidden md:flex items-center gap-8">
          {["Pricing", "Get Estimate", "About", "FAQ", "Contact"].map((item) => (
            <a
              key={item}
              href={`#${item === "Get Estimate" ? "estimator" : item.toLowerCase()}`}
              className={`font-body text-sm transition-colors hover:text-accent ${scrolled ? "text-muted-foreground" : "text-primary-foreground/70"}`}
            >
              {item}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" className="font-display tracking-wider hidden sm:inline-flex bg-accent hover:bg-accent/90 text-accent-foreground" asChild>
            <Link to="/order">
              <ShoppingCart className="w-4 h-4 mr-1" />
              ORDER NOW
            </Link>
          </Button>
          <Button size="sm" variant="outline" className={`font-display tracking-wider hidden sm:inline-flex ${scrolled ? "" : "border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"}`} asChild>
            <a href="tel:+15551234567">
              <Phone className="w-4 h-4 mr-1" />
              CALL
            </a>
          </Button>
          <button className={`md:hidden ${scrolled ? "text-foreground" : "text-primary-foreground"}`} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="md:hidden bg-background border-t border-border px-6 py-4 space-y-3 shadow-lg">
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
            <Button size="sm" className="font-display tracking-wider w-full bg-accent hover:bg-accent/90 text-accent-foreground" asChild>
              <Link to="/order" onClick={() => setMenuOpen(false)}>
                <ShoppingCart className="w-4 h-4 mr-1" /> ORDER NOW
              </Link>
            </Button>
            <Button size="sm" variant="outline" className="font-display tracking-wider w-full" asChild>
              <a href="tel:+15551234567">
                <Phone className="w-4 h-4 mr-1" /> CALL
              </a>
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
