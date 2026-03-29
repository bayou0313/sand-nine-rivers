import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight } from "lucide-react";
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

    // Auto-dismiss after 10 seconds
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
          transition={{ duration: 0.4 }}
          className="overflow-hidden"
        >
          <div
            className="px-4 py-3 flex items-center justify-between gap-4"
            style={{ backgroundColor: "#C07A00" }}
          >
            <div className="flex-1">
              <p className="font-display text-sm tracking-wider" style={{ color: "#0D2137" }}>
                {isCheckoutStage
                  ? "Welcome back! Your order is still waiting."
                  : "Welcome back! Continue where you left off?"}
              </p>
              {session.delivery_address && (
                <p className="font-body text-xs mt-0.5" style={{ color: "#0D2137", opacity: 0.8 }}>
                  {session.delivery_address}
                </p>
              )}
              {session.calculated_price && (session.stage === "got_price" || isCheckoutStage) && (
                <p className="font-body text-xs mt-0.5 font-bold" style={{ color: "#0D2137" }}>
                  Your last price: {formatCurrency(session.calculated_price)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isCheckoutStage ? (
                <Button
                  size="sm"
                  className="font-display tracking-wider text-xs h-8 rounded-lg"
                  style={{ backgroundColor: "#0D2137", color: "#C07A00" }}
                  asChild
                >
                  <Link
                    to={`/order?address=${encodeURIComponent(session.delivery_address || "")}&price=${session.calculated_price || ""}&utm_source=return_visitor`}
                  >
                    Complete Your Order <ArrowRight className="w-3 h-3 ml-1" />
                  </Link>
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="font-display tracking-wider text-xs h-8 rounded-lg"
                  style={{ backgroundColor: "#0D2137", color: "#C07A00" }}
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
              <button onClick={dismiss} className="p-1 rounded hover:opacity-70 transition-opacity" style={{ color: "#0D2137" }}>
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
