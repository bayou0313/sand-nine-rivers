import { Phone, Mail, MapPin, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="py-12 bg-foreground">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <p className="font-display text-3xl text-background tracking-wider mb-3">RIVERSAND</p>
            <p className="font-body text-background/50 text-sm leading-relaxed">
              Quality river sand delivered across the Greater New Orleans area. 9 yards for $195, same-day delivery available.
            </p>
          </div>
          <div>
            <p className="font-display text-lg text-background tracking-wider mb-3">CONTACT</p>
            <div className="space-y-2 font-body text-sm text-background/50">
              <a href="tel:+15551234567" className="flex items-center gap-2 hover:text-background transition-colors">
                <Phone className="w-4 h-4" /> (555) 123-4567
              </a>
              <a href="mailto:info@riversand.net" className="flex items-center gap-2 hover:text-background transition-colors">
                <Mail className="w-4 h-4" /> info@riversand.net
              </a>
              <p className="flex items-center gap-2">
                <MapPin className="w-4 h-4" /> 1215 River Rd, Bridge City, LA 70094
              </p>
            </div>
          </div>
          <div>
            <p className="font-display text-lg text-background tracking-wider mb-3">QUICK LINKS</p>
            <div className="space-y-2 font-body text-sm text-background/50">
              <a href="#pricing" className="block hover:text-background transition-colors">Pricing</a>
              <a href="#estimator" className="block hover:text-background transition-colors">Get Estimate</a>
              <a href="#about" className="block hover:text-background transition-colors">About Us</a>
              <a href="#faq" className="block hover:text-background transition-colors">FAQ</a>
              <a href="#contact" className="block hover:text-background transition-colors">Contact</a>
            </div>
          </div>
          <div>
            <p className="font-display text-lg text-background tracking-wider mb-3">ORDER</p>
            <div className="space-y-2 font-body text-sm text-background/50">
              <Link to="/order" className="flex items-center gap-2 hover:text-background transition-colors">
                <ShoppingCart className="w-4 h-4" /> Order Online
              </Link>
              <p>Cash on Delivery (COD)</p>
              <p>Same-day available</p>
              <p>Licensed & Insured</p>
            </div>
          </div>
        </div>
        <div className="border-t border-background/10 pt-6 text-center">
          <p className="font-body text-background/40 text-sm">
            © {new Date().getFullYear()} RiverSand.net — Serving the Greater New Orleans Area
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
