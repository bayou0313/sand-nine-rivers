import { Phone, Mail, MapPin, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import logoImg from "@/assets/riversand-logo.png";

const Footer = () => {
  return (
    <footer className="py-14 bg-foreground">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          <div>
            <img src={logoImg} alt="RiverSand logo" className="h-[200px] w-auto object-contain mb-3 brightness-0 invert pt-[5px]" loading="lazy" />
            <p className="font-body text-background/40 text-sm leading-relaxed">
              Quality river sand delivered across the Greater New Orleans area. 9 yards for $195, same-day delivery available Mon–Fri.
            </p>
          </div>
          <div>
            <p className="font-display text-lg text-background tracking-widest mb-4">CONTACT</p>
            <div className="space-y-3 font-body text-sm text-background/40">
              <a href="tel:+18554689297" className="flex items-center gap-2 hover:text-background transition-colors">
                <Phone className="w-4 h-4" /> 1-855-GOT-WAYS
              </a>
              <a href="mailto:info@riversand.net" className="flex items-center gap-2 hover:text-background transition-colors">
                <Mail className="w-4 h-4" /> info@riversand.net
              </a>
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Greater New Orleans, LA
              </p>
            </div>
          </div>
          <div>
            <p className="font-display text-lg text-background tracking-widest mb-4">QUICK LINKS</p>
            <div className="space-y-3 font-body text-sm text-background/40">
              <a href="#pricing" className="block hover:text-background transition-colors">Pricing</a>
              <a href="#estimator" className="block hover:text-background transition-colors">Get Estimate</a>
              <a href="#about" className="block hover:text-background transition-colors">About Us</a>
              <a href="#faq" className="block hover:text-background transition-colors">FAQ</a>
              <a href="#contact" className="block hover:text-background transition-colors">Contact</a>
            </div>
          </div>
          <div>
            <p className="font-display text-lg text-background tracking-widest mb-4">ORDER</p>
            <div className="space-y-3 font-body text-sm text-background/40">
              <Link to="/order" className="flex items-center gap-2 hover:text-background transition-colors">
                <ShoppingCart className="w-4 h-4" /> Order Online
              </Link>
              <p>Mon–Fri + Saturday (+$35)</p>
              <p>Same-day before 10 AM CT</p>
              <p>Licensed & Insured</p>
            </div>
          </div>
        </div>
        <div className="border-t border-background/10 pt-8 text-center">
          <p className="font-body text-background/30 text-sm">
            © {new Date().getFullYear()} RiverSand.net — Serving the Greater New Orleans Area · Powered by Haulogix, LLC
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
