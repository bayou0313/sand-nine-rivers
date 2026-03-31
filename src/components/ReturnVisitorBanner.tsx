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
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!session) return;
    if (session.visit_count <= 1) return;
    if (!session.delivery_address) return;
    if (session.stage === "completed_order") return;
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    // Delay appearance slightly for smoother UX
    const showTimer = setTimeout(() => setVisible(true), 800);

    return () => clearTimeout(showTimer);
  }, [session]);

  // Countdown timer + progress bar
  useEffect(() => {
    if (!visible) return;

    const duration = 10000;
    const interval = 50;
    const start = Date.now();

    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(tick);
        dismiss();
      }
    }, interval);

    return () => clearInterval(tick);
  }, [visible]);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem(DISMISSED_KEY, "1");
  };

  const isCheckoutStage =
    session?.stage === "started_checkout" || session?.stage === "reached_payment";

  return (
    <AnimatePresence>
      {visible && session && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={dismiss}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
            className="fixed z-[61] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md"
          >
            <div className="bg-primary rounded-2xl shadow-2xl overflow-hidden border border-white/10">
              {/* Progress bar */}
              <div className="h-1 bg-white/10">
                <motion.div
                  className="h-full bg-accent"
                  style={{ width: `${progress}%` }}
                  transition={{ duration: 0.05, ease: "linear" }}
                />
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/15 shrink-0">
                      <MapPin className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-display text-base tracking-wider text-primary-foreground">
                        {isCheckoutStage ? "YOUR ORDER IS WAITING" : "WELCOME BACK"}
                      </h3>
                      <p className="font-body text-xs text-primary-foreground/50 mt-0.5">
                        {isCheckoutStage
                          ? "Pick up right where you left off."
                          : "Continue where you left off?"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={dismiss}
                    className="p-1.5 rounded-full text-primary-foreground/40 hover:text-primary-foreground hover:bg-white/10 transition-all shrink-0"
                    aria-label="Dismiss"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Address card */}
                {session.delivery_address && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-xs text-primary-foreground/40 uppercase tracking-wider">
                        Delivery to
                      </p>
                      <p className="font-body text-sm text-primary-foreground mt-0.5 truncate">
                        {session.delivery_address}
                      </p>
                    </div>
                    {session.calculated_price &&
                      (session.stage === "got_price" || isCheckoutStage) && (
                        <div className="text-right shrink-0">
                          <p className="font-body text-xs text-primary-foreground/40 uppercase tracking-wider">
                            Price
                          </p>
                          <p className="font-display text-lg text-accent leading-tight">
                            {formatCurrency(session.calculated_price)}
                          </p>
                        </div>
                      )}
                  </div>
                )}

                {/* CTA */}
                {isCheckoutStage ? (
                  <Button
                    className="w-full h-11 font-display tracking-wider text-sm bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl shadow-md shadow-accent/20"
                    asChild
                  >
                    <Link
                      to={`/order?address=${encodeURIComponent(session.delivery_address || "")}&price=${session.calculated_price || ""}&utm_source=return_visitor`}
                      onClick={dismiss}
                    >
                      COMPLETE YOUR ORDER <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    className="w-full h-11 font-display tracking-wider text-sm bg-accent hover:bg-accent/90 text-accent-foreground rounded-xl shadow-md shadow-accent/20"
                    onClick={() => {
                      if (session.delivery_address && onRecalculate) {
                        onRecalculate(session.delivery_address);
                      }
                      dismiss();
                    }}
                  >
                    GET MY PRICE <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ReturnVisitorBanner;
