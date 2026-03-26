import { MessageCircle, Phone, Mail, X, Check, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const WHATSAPP_NUMBER = "15043582000";
const PHONE_NUMBER = "+18554689297";
const MESSAGE = "Hi! I'm interested in ordering river sand delivery in New Orleans.";

type ContactMode = "whatsapp" | "phone" | "message";

const WhatsAppButton = () => {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<ContactMode>("whatsapp");
  const [showLabel, setShowLabel] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formData, setFormData] = useState({ name: "", phone: "", message: "" });
  const isMobile = useIsMobile();

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const altMode: ContactMode = isMobile ? "phone" : "message";

  const toggleMode = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = mode === "whatsapp" ? altMode : "whatsapp";
    setMode(next);
    setShowLabel(true);
    setShowForm(false);
    setSent(false);
    setTimeout(() => setShowLabel(false), 2000);
  }, [mode, altMode]);

  const handleMainClick = useCallback((e: React.MouseEvent) => {
    if (mode === "message") {
      e.preventDefault();
      setShowForm((prev) => !prev);
    }
  }, [mode]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) return;
    setSending(true);
    try {
      await supabase.functions.invoke("send-email", {
        body: {
          type: "contact",
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          message: formData.message.trim(),
        },
      });
      setSent(true);
      setFormData({ name: "", phone: "", message: "" });
      setTimeout(() => {
        setShowForm(false);
        setSent(false);
      }, 2500);
    } catch {
      // silent fail
    } finally {
      setSending(false);
    }
  }, [formData]);

  const href =
    mode === "whatsapp"
      ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(MESSAGE)}`
      : mode === "phone"
        ? `tel:${PHONE_NUMBER}`
        : "#";

  const label = mode === "whatsapp" ? "WhatsApp" : mode === "phone" ? "Call Us" : "Message Us";
  const bg = mode === "whatsapp" ? "#25D366" : "hsl(var(--primary))";
  const shadowColor = mode === "whatsapp" ? "rgba(37,211,102,0.3)" : "hsl(var(--primary) / 0.3)";

  const IconMain = mode === "whatsapp" ? MessageCircle : mode === "phone" ? Phone : Mail;
  const IconAlt = mode === "whatsapp"
    ? (isMobile ? Phone : Mail)
    : MessageCircle;

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed bottom-20 lg:bottom-6 left-6 z-50 flex flex-col items-start gap-2">
          {/* Desktop message form */}
          <AnimatePresence>
            {showForm && mode === "message" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 10 }}
                transition={{ duration: 0.2 }}
                className="w-[300px] bg-background border border-border rounded-2xl shadow-2xl p-4 mb-2"
              >
                {sent ? (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center"
                    >
                      <Check className="w-5 h-5 text-white" />
                    </motion.div>
                    <p className="text-sm font-medium text-foreground">Message sent!</p>
                    <p className="text-xs text-muted-foreground">We'll get back to you shortly.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">Send us a message</span>
                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <Input
                      placeholder="Your name"
                      value={formData.name}
                      onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
                      required
                      maxLength={100}
                      className="text-sm h-9"
                    />
                    <Input
                      placeholder="Phone number"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData((d) => ({ ...d, phone: e.target.value }))}
                      required
                      maxLength={20}
                      className="text-sm h-9"
                    />
                    <Textarea
                      placeholder="Short message (optional)"
                      value={formData.message}
                      onChange={(e) => setFormData((d) => ({ ...d, message: e.target.value }))}
                      maxLength={500}
                      className="text-sm min-h-[60px] resize-none"
                      rows={2}
                    />
                    <Button type="submit" size="sm" disabled={sending} className="w-full gap-2">
                      <Send className="w-3.5 h-3.5" />
                      {sending ? "Sending..." : "Send Message"}
                    </Button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative flex items-center gap-2">
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
              <motion.a
                href={href}
                target={mode === "whatsapp" ? "_blank" : undefined}
                rel="noopener noreferrer"
                onClick={handleMainClick}
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
                    <IconMain className="w-6 h-6" />
                  </motion.span>
                </AnimatePresence>
              </motion.a>

              {/* Toggle pill */}
              <motion.button
                onClick={toggleMode}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-background border border-border shadow-sm flex items-center justify-center"
                aria-label="Switch contact mode"
              >
                <IconAlt className="w-2.5 h-2.5 text-foreground" />
              </motion.button>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default WhatsAppButton;
