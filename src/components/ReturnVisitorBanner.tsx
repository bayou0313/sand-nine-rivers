import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { Link } from "react-router-dom";

interface ReturnVisitorBannerProps {
  session: {
    visit_count: number;
    delivery_address?: string | null;
    calculated_price?: number | null;
    stage?: string | null;
  } | null;
  onRecalculate?: (address: string) => void;
}

const DISMISSED_KEY = "rsnd_banner_dismissed";

const ReturnVisitorBanner = ({ session, onRecalculate }: ReturnVisitorBannerProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!session) return;
    if (session.visit_count <= 1) return;
    if (!session.delivery_address) return;
    if (session.stage === "completed_order") return;
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    setVisible(true);

    const timer = setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem(DISMISSED_KEY, "1");
    }, 10000);

    return () => clearTimeout(timer);
  }, [session]);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem(DISMISSED_KEY, "1");
  };

  const isCheckoutStage = session?.stage === "started_checkout" || session?.stage === "reached_payment";

  return (
    <AnimatePresence>
      {visible && session && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="overflow-hidden bg-accent"
        >
          <div className="container mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
            {/* Left: message + address */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-primary/15 shrink-0">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-sm tracking-wider text-primary leading-tight">
                  {isCheckoutStage
                    ? "Welcome back! Your order is still waiting."
                    : "Welcome back! Continue where you left off?"}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {session.delivery_address && (
                    <p className="font-body text-xs text-primary/70 truncate max-w-[280px]">
                      {session.delivery_address}
                    </p>
                  )}
                  {session.calculated_price && (session.stage === "got_price" || isCheckoutStage) && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/15 font-display text-xs text-primary font-bold tracking-wide">
                      {formatCurrency(session.calculated_price)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: CTA + dismiss */}
            <div className="flex items-center gap-2 shrink-0">
              {isCheckoutStage ? (
                <Button
                  size="sm"
                  className="font-display tracking-wider text-xs h-8 rounded-lg bg-primary text-accent hover:bg-primary/90 shadow-sm"
                  asChild
                >
                  <Link
                    to={`/order?address=${encodeURIComponent(session.delivery_address || "")}&price=${session.calculated_price || ""}&utm_source=return_visitor`}
                  >
                    COMPLETE ORDER <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="font-display tracking-wider text-xs h-8 rounded-lg bg-primary text-accent hover:bg-primary/90 shadow-sm"
                  onClick={() => {
                    if (session.delivery_address && onRecalculate) {
                      onRecalculate(session.delivery_address);
                    }
                    dismiss();
                  }}
                >
                  GET MY PRICE <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              )}
              <button
                onClick={dismiss}
                className="p-1.5 rounded-full text-primary/60 hover:text-primary hover:bg-primary/10 transition-all"
                aria-label="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReturnVisitorBanner;
