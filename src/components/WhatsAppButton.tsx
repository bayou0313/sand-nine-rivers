import { MessageCircle, Phone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";

const WHATSAPP_NUMBER = "15043582000";
const PHONE_NUMBER = "+18554689297";
const MESSAGE = "Hi! I'm interested in ordering river sand delivery in New Orleans.";

type ContactMode = "whatsapp" | "phone";

const WhatsAppButton = () => {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<ContactMode>("whatsapp");
  const [showLabel, setShowLabel] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const toggleMode = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMode((prev) => (prev === "whatsapp" ? "phone" : "whatsapp"));
    setShowLabel(true);
    setTimeout(() => setShowLabel(false), 2000);
  }, []);

  const href =
    mode === "whatsapp"
      ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(MESSAGE)}`
      : `tel:${PHONE_NUMBER}`;

  const label = mode === "whatsapp" ? "WhatsApp" : "Call Us";
  const bg = mode === "whatsapp" ? "#25D366" : "hsl(var(--primary))";
  const shadowColor = mode === "whatsapp" ? "rgba(37,211,102,0.3)" : "hsl(var(--primary) / 0.3)";

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed bottom-20 lg:bottom-6 left-6 z-50 flex items-center gap-2">
          {/* Label */}
          <AnimatePresence>
            {showLabel && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="absolute left-14 bg-background text-foreground text-xs font-medium px-2.5 py-1 rounded-full shadow-md border border-border whitespace-nowrap"
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Main button */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="relative"
          >
            {/* Toggle area (right-click or double-tap concept → simple: single tap toggles, hold/long-press opens link) */}
            <motion.a
              href={href}
              target={mode === "whatsapp" ? "_blank" : undefined}
              rel="noopener noreferrer"
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.9 }}
              className="block p-3.5 rounded-full text-white transition-colors duration-300"
              style={{
                backgroundColor: bg,
                boxShadow: `0 4px 15px ${shadowColor}`,
              }}
              aria-label={label}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={mode}
                  initial={{ rotateY: 90, opacity: 0 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: -90, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="block"
                >
                  {mode === "whatsapp" ? (
                    <MessageCircle className="w-6 h-6" />
                  ) : (
                    <Phone className="w-6 h-6" />
                  )}
                </motion.span>
              </AnimatePresence>
            </motion.a>

            {/* Small toggle pill */}
            <motion.button
              onClick={toggleMode}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-background border border-border shadow-sm flex items-center justify-center"
              aria-label="Switch contact mode"
            >
              {mode === "whatsapp" ? (
                <Phone className="w-2.5 h-2.5 text-foreground" />
              ) : (
                <MessageCircle className="w-2.5 h-2.5 text-foreground" />
              )}
            </motion.button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default WhatsAppButton;
