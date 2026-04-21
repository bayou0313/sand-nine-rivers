import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

interface Holiday {
  id: string;
  name: string;
  holiday_date: string;
  is_closed: boolean;
}

const EXCLUDED_PREFIXES = ["/order", "/admin", "/leads", "/review"];

const HolidayBanner = () => {
  const location = useLocation();
  const [holiday, setHoliday] = useState<Holiday | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const isExcluded = EXCLUDED_PREFIXES.some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    if (isExcluded) return;

    const today = new Date().toISOString().slice(0, 10);
    const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    supabase
      .from("holidays")
      .select("id, name, holiday_date, is_closed")
      .eq("customer_visible", true)
      .gte("holiday_date", today)
      .lte("holiday_date", in30Days)
      .order("holiday_date", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const dismissedKey = `holiday_banner_dismissed_${data.id}`;
        if (sessionStorage.getItem(dismissedKey) === "true") {
          setDismissed(true);
          return;
        }
        setHoliday(data as Holiday);
      });
  }, [isExcluded]);

  if (isExcluded || !holiday || dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(`holiday_banner_dismissed_${holiday.id}`, "true");
    setDismissed(true);
  };

  const humanDate = new Date(holiday.holiday_date + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const bgColor = holiday.is_closed ? "#dc2626" : "#16a34a";
  const label = holiday.is_closed ? "CLOSED" : "OPEN";
  const message = holiday.is_closed
    ? `We will be closed on ${humanDate} for ${holiday.name}. Please plan your delivery accordingly.`
    : `We will be open on ${humanDate} for ${holiday.name}. Same-day and scheduled deliveries available.`;

  return (
    <div
      style={{
        backgroundColor: bgColor,
        color: "#FFFFFF",
        padding: "10px 44px 10px 16px",
        textAlign: "center",
        fontSize: "14px",
        fontWeight: 500,
        position: "relative",
        letterSpacing: "0.3px",
      }}
      role="status"
      aria-live="polite"
    >
      <strong style={{ marginRight: "8px", letterSpacing: "1px" }}>{label}:</strong>
      {message}
      <button
        onClick={handleDismiss}
        aria-label="Dismiss holiday banner"
        style={{
          position: "absolute",
          right: "12px",
          top: "50%",
          transform: "translateY(-50%)",
          background: "transparent",
          border: "none",
          color: "#FFFFFF",
          cursor: "pointer",
          padding: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.85,
        }}
      >
        <X size={18} />
      </button>
    </div>
  );
};

export default HolidayBanner;
