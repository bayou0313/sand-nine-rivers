import { Phone, Menu, X, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { loadCart, clearCart, type CartState } from "@/lib/cart";
import { formatCurrency } from "@/lib/format";

const navLinks = ["Pricing", "How It Works", "Why Us", "About", "FAQ", "Learn More", "Contact"];

const sectionIdMap: Record<string, string> = {
  "Pricing": "pricing",
  "How It Works": "how-it-works",
  "Why Us": "why-us",
  "About": "about",
  "FAQ": "faq",
  "Learn More": "learn-more",
  "Contact": "contact",
};

const CartDropdown = ({ cart, onContinue, onClear }: { cart: CartState; onContinue: () => void; onClear: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: -8, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: -8, scale: 0.95 }}
    transition={{ duration: 0.15 }}
    className="absolute right-0 top-full mt-2 w-72 bg-card border border-border rounded-xl shadow-xl p-4 z-50"
  >
    <p className="font-body text-xs text-muted-foreground mb-1">Saved order</p>
    <p className="font-body text-sm text-foreground truncate" title={cart.address}>
      {cart.address.length > 30 ? cart.address.slice(0, 30) + "…" : cart.address}
    </p>
    <p className="font-display text-lg text-accent mt-1">
      {cart.quantity} load{cart.quantity > 1 ? "s" : ""} · {formatCurrency(cart.price * cart.quantity)}
    </p>
    <button
      onClick={onContinue}
      className="w-full mt-3 h-9 font-display tracking-wider text-sm bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg transition-colors"
    >
      CONTINUE ORDER
    </button>
    <button
      onClick={onClear}
      className="w-full mt-2 text-xs font-body text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
    >
      Clear
    </button>
  </motion.div>
);

const Navbar = ({ solid = false, logoHref = "/", activeSections }: { solid?: boolean; logoHref?: string; activeSections?: string[] }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(solid);
  const [cart, setCart] = useState<CartState | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const cartRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(solid || window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [solid]);

  const refreshCart = useCallback(() => setCart(loadCart()), []);

  useEffect(() => {
    refreshCart();
    const onFocus = () => refreshCart();
    const onVisibility = () => { if (document.visibilityState === "visible") refreshCart(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshCart]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!cartOpen) return;
    const handler = (e: MouseEvent) => {
      if (cartRef.current && !cartRef.current.contains(e.target as Node)) setCartOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [cartOpen]);

  const handleContinue = () => {
    if (!cart) return;
    const params = new URLSearchParams({
      address: cart.address,
      distance: String(cart.distance),
      price: String(cart.price),
      quantity: String(cart.quantity),
      pit_id: cart.pitId,
      pit_name: cart.pitName,
    });
    if (cart.operatingDays.length > 0) params.set("operating_days", cart.operatingDays.join(","));
    if (cart.satSurcharge) params.set("sat_surcharge", String(cart.satSurcharge));
    if (cart.sameDayCutoff) params.set("same_day_cutoff", cart.sameDayCutoff);
    setCartOpen(false);
    navigate(`/order?${params.toString()}`);
  };

  const handleClear = () => {
    clearCart();
    setCart(null);
    setCartOpen(false);
  };

  return (
    <motion.nav
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`fixed left-0 right-0 z-50 transition-all duration-500 top-[var(--banner-offset,0px)] ${
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
            title="RiverSand.net — Bulk River Sand Delivery"
            width={199}
            height={80}
            className="h-[67px] lg:h-[80px] w-auto max-w-none object-contain transition-all duration-500"
          />
        </motion.a>

        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((item) => {
            const sectionId = sectionIdMap[item];
            const isLocal = !activeSections || activeSections.includes(sectionId);
            const href = isLocal ? `#${sectionId}` : `/#${sectionId}`;
            return (
              <a
                key={item}
                href={href}
                className={`font-body text-sm transition-colors duration-300 hover:text-accent ${
                  scrolled ? "text-primary-foreground/90" : "text-primary-foreground/70"
                }`}
              >
                {item}
              </a>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {/* Cart icon */}
          {cart && (
            <div className="relative" ref={cartRef}>
              <button
                onClick={() => setCartOpen(!cartOpen)}
                className="relative p-2 text-primary-foreground/80 hover:text-accent transition-colors"
                aria-label="View saved order"
              >
                <ShoppingCart className="w-5 h-5" />
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent border-2 border-primary" />
              </button>
              <AnimatePresence>
                {cartOpen && (
                  <CartDropdown cart={cart} onContinue={handleContinue} onClear={handleClear} />
                )}
              </AnimatePresence>
            </div>
          )}

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
            {navLinks.map((item, i) => {
              const sectionId = sectionIdMap[item];
              const isLocal = !activeSections || activeSections.includes(sectionId);
              const href = isLocal ? `#${sectionId}` : `/#${sectionId}`;
              return (
                <motion.a
                  key={item}
                  href={href}
                  className="block font-body text-sm text-primary-foreground/70 hover:text-accent transition-colors"
                  onClick={() => setMenuOpen(false)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06, duration: 0.3 }}
                  whileHover={{ x: 6 }}
                >
                  {item}
                </motion.a>
              );
            })}

            {/* Mobile cart banner */}
            {cart && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-3 bg-accent/10 border border-accent/20 rounded-lg"
              >
                <p className="font-body text-xs text-primary-foreground/60 truncate">{cart.address}</p>
                <p className="font-display text-sm text-accent">
                  {cart.quantity} load{cart.quantity > 1 ? "s" : ""} · {formatCurrency(cart.price * cart.quantity)}
                </p>
                <button
                  onClick={() => { setMenuOpen(false); handleContinue(); }}
                  className="mt-2 w-full h-8 font-display tracking-wider text-xs bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg transition-colors"
                >
                  CONTINUE ORDER
                </button>
              </motion.div>
            )}

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
