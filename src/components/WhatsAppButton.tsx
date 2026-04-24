import { MessageCircle, Phone, Mail, X, Check, Send, CalendarIcon, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, isSameDay, isSunday, isBefore, startOfDay, isSaturday } from "date-fns";
import { cn } from "@/lib/utils";
import { formatPhone } from "@/lib/format";
import { formatProperName, formatProperNameFinal, formatSentence } from "@/lib/textFormat";
import { WAYS_PHONE_RAW } from "@/lib/constants";

const WHATSAPP_NUMBER = "15043582000";
const PHONE_NUMBER = `+${WAYS_PHONE_RAW}`;
const MESSAGE = "Hi! I'm interested in ordering river sand delivery in New Orleans.";

type ContactMode = "whatsapp" | "phone" | "message";

const WEEKDAY_WINDOWS = [
  { label: "8–10 AM", startHour: 8 },
  { label: "10 AM–12 PM", startHour: 10 },
  { label: "12–2 PM", startHour: 12 },
  { label: "2–4 PM", startHour: 14 },
  { label: "4–6 PM", startHour: 16 },
];

const SATURDAY_WINDOWS = [
  { label: "8–10 AM", startHour: 8 },
  { label: "10 AM–12 PM", startHour: 10 },
];

function getAvailableWindows(selectedDate: Date): { label: string; startHour: number }[] {
  const now = new Date();
  const isToday = isSameDay(selectedDate, now);
  const isSat = isSaturday(selectedDate);
  const baseWindows = isSat ? SATURDAY_WINDOWS : WEEKDAY_WINDOWS;

  if (!isToday) return baseWindows;

  const currentHour = now.getHours();
  return baseWindows.filter((w) => w.startHour > currentHour);
}

function isBusinessDay(date: Date): boolean {
  return !isSunday(date);
}

const WhatsAppButton = () => {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<ContactMode>("message");
  const [showLabel, setShowLabel] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formData, setFormData] = useState({ name: "", phone: "", notes: "" });
  const [callbackDate, setCallbackDate] = useState<Date>(new Date());
  const [timeWindow, setTimeWindow] = useState<string>("ASAP");
  const isMobile = useIsMobile();

  // Set initial mode based on device
  useEffect(() => {
    if (isMobile !== undefined) {
      setMode(isMobile ? "whatsapp" : "message");
    }
  }, [isMobile]);

  // Guard: if viewport changes to desktop while mode is whatsapp, switch to message
  useEffect(() => {
    if (!isMobile && mode === "whatsapp") {
      setMode("message");
    }
  }, [isMobile, mode]);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const availableWindows = useMemo(() => getAvailableWindows(callbackDate), [callbackDate]);

  const showAsap = useMemo(() => {
    if (!isSameDay(callbackDate, new Date())) return false;
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    if (day === 0) return false;
    if (day === 6) return hour < 12;
    return hour >= 8 && hour < 18;
  }, [callbackDate]);

  useEffect(() => {
    const windows = getAvailableWindows(callbackDate);
    const isToday = isSameDay(callbackDate, new Date());
    if (isToday && showAsap) {
      setTimeWindow("ASAP");
    } else if (windows.length > 0) {
      setTimeWindow(windows[0].label);
    } else {
      setTimeWindow("");
    }
  }, [callbackDate, showAsap]);

  // Desktop: message ↔ phone, Mobile: whatsapp ↔ phone
  const toggleMode = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMobile) {
      setMode((m) => (m === "whatsapp" ? "phone" : "whatsapp"));
    } else {
      setMode((m) => (m === "message" ? "phone" : "message"));
    }
    setShowLabel(true);
    setShowForm(false);
    setSent(false);
    setTimeout(() => setShowLabel(false), 2000);
  }, [isMobile]);

  const handleMainClick = useCallback((e: React.MouseEvent) => {
    if (mode === "message") {
      e.preventDefault();
      setShowForm((prev) => !prev);
    }
  }, [mode]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim() || !timeWindow) return;
    setSending(true);
    try {
      await supabase.functions.invoke("send-email", {
        body: {
          type: "callback",
          data: {
            name: formData.name.trim(),
            phone: formData.phone.trim(),
            date: format(callbackDate, "EEEE, MMMM d, yyyy"),
            time_window: timeWindow,
            notes: formData.notes.trim(),
          },
        },
      });
      setSent(true);
      setFormData({ name: "", phone: "", notes: "" });
      setTimeout(() => {
        setShowForm(false);
        setSent(false);
      }, 2500);
    } catch {
      // silent fail
    } finally {
      setSending(false);
    }
  }, [formData, callbackDate, timeWindow]);

  const href =
    mode === "whatsapp"
      ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(MESSAGE)}`
      : mode === "phone"
        ? `tel:${PHONE_NUMBER}`
        : "#";

  const label = mode === "whatsapp" ? "WhatsApp" : mode === "phone" ? "Call Us" : "Request Callback";
  const bg = mode === "whatsapp" ? "#25D366" : "hsl(var(--primary))";
  const shadowColor = mode === "whatsapp" ? "rgba(37,211,102,0.3)" : "hsl(var(--primary) / 0.3)";

  const IconMain = mode === "whatsapp" ? MessageCircle : mode === "phone" ? Phone : Phone;
  const IconAlt = isMobile
    ? (mode === "whatsapp" ? Phone : MessageCircle)
    : (mode === "message" ? Phone : Phone);

  const disableDate = (date: Date) => {
    if (isSunday(date)) return true;
    if (isBefore(date, startOfDay(new Date()))) return true;
    return false;
  };

  const isSatSelected = isSaturday(callbackDate);

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed bottom-36 lg:bottom-16 right-6 z-50 flex flex-col items-end gap-2">
          {/* Callback request form */}
          <AnimatePresence>
            {showForm && mode === "message" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 10 }}
                transition={{ duration: 0.2 }}
                className="w-[320px] bg-background border border-border rounded-2xl shadow-2xl p-4 mb-2"
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
                    <p className="text-sm font-medium text-foreground">Callback requested!</p>
                    <p className="text-xs text-muted-foreground">We'll call you soon.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        Request a Callback
                      </span>
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
                      onChange={(e) => setFormData((d) => ({ ...d, name: formatProperName(e.target.value) }))}
                      onBlur={(e) => setFormData((d) => ({ ...d, name: formatProperNameFinal(e.target.value) }))}
                      required
                      maxLength={100}
                      autoComplete="name"
                      className="text-sm h-9"
                    />
                    <Input
                      placeholder="Phone number"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData((d) => ({ ...d, phone: formatPhone(e.target.value) }))}
                      required
                      maxLength={14}
                      className="text-sm h-9"
                    />

                    {/* Date picker */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal h-9 text-sm",
                            !callbackDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {format(callbackDate, "EEE, MMM d")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[60]" align="end">
                        <Calendar
                          mode="single"
                          selected={callbackDate}
                          onSelect={(d) => d && setCallbackDate(d)}
                          disabled={disableDate}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>

                    {/* Time window */}
                    <Select value={timeWindow} onValueChange={setTimeWindow}>
                      <SelectTrigger className="h-9 text-sm">
                        <Clock className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                        <SelectValue placeholder="Select time window" />
                      </SelectTrigger>
                      <SelectContent className="z-[60]">
                        {showAsap && <SelectItem value="ASAP">ASAP</SelectItem>}
                        {availableWindows.map((w) => (
                          <SelectItem key={w.label} value={w.label}>{w.label}</SelectItem>
                        ))}
                        {!showAsap && availableWindows.length === 0 && (
                          <SelectItem value="" disabled>No windows available</SelectItem>
                        )}
                      </SelectContent>
                    </Select>

                    {isSatSelected && (
                      <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                        ⚠️ Limited Saturday availability — 5 spots
                      </p>
                    )}

                    <Input
                      placeholder="Notes (optional)"
                      value={formData.notes}
                      onChange={(e) => setFormData((d) => ({ ...d, notes: e.target.value }))}
                      maxLength={200}
                      className="text-sm h-9"
                    />

                    <Button
                      type="submit"
                      size="sm"
                      disabled={sending || (!showAsap && availableWindows.length === 0)}
                      className="w-full gap-2"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {sending ? "Submitting..." : "Request Callback"}
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
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="absolute right-14 bg-primary text-primary-foreground text-xs font-medium px-2.5 py-1 rounded-full shadow-md border border-primary/20 whitespace-nowrap"
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
                className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-background border border-border shadow-sm flex items-center justify-center"
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
