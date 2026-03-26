import { Phone, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-6 flex items-center justify-between h-16">
        <a href="/" className="text-3xl font-display text-primary tracking-wider">
          RIVERSAND
        </a>
        <div className="hidden md:flex items-center gap-8">
          <a href="#pricing" className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
          <a href="#estimator" className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors">Get Estimate</a>
          <a href="#about" className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors">About</a>
          <a href="#faq" className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
          <a href="#contact" className="font-body text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</a>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" className="font-display tracking-wider hidden sm:inline-flex" asChild>
            <a href="tel:+15551234567">
              <Phone className="w-4 h-4 mr-1" />
              CALL NOW
            </a>
          </Button>
          <button className="md:hidden text-foreground" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="md:hidden bg-background border-t border-border px-6 py-4 space-y-3">
          <a href="#pricing" className="block font-body text-sm text-muted-foreground" onClick={() => setMenuOpen(false)}>Pricing</a>
          <a href="#estimator" className="block font-body text-sm text-muted-foreground" onClick={() => setMenuOpen(false)}>Get Estimate</a>
          <a href="#about" className="block font-body text-sm text-muted-foreground" onClick={() => setMenuOpen(false)}>About</a>
          <a href="#faq" className="block font-body text-sm text-muted-foreground" onClick={() => setMenuOpen(false)}>FAQ</a>
          <a href="#contact" className="block font-body text-sm text-muted-foreground" onClick={() => setMenuOpen(false)}>Contact</a>
          <Button size="sm" className="font-display tracking-wider w-full" asChild>
            <a href="tel:+15551234567">
              <Phone className="w-4 h-4 mr-1" />
              CALL NOW
            </a>
          </Button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
