import { useEffect, useRef } from "react";
import { toIsoDate, todayIsoDate } from "@/lib/schedule-adapter";

const BRAND_NAVY = "#0D2137";
const BRAND_GOLD = "#C07A00";

interface Props {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  /** date(YYYY-MM-DD) -> { orders, loads } */
  counts: Record<string, { orders: number; loads: number }>;
}

/**
 * Horizontal day strip: 7 past + 83 future = 91 days.
 * Selected day is highlighted; today gets a gold ring.
 */
export default function WeekStrip({ selectedDate, onSelectDate, counts }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const today = todayIsoDate();
  const selectedIso = toIsoDate(selectedDate);

  // Build the 91-day window centered on today.
  const days: Date[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let offset = -7; offset <= 83; offset++) {
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    days.push(d);
  }

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current.querySelector("[data-selected='true']");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedIso]);

  return (
    <div
      ref={ref}
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        padding: "8px 4px",
        scrollbarWidth: "thin",
      }}
      role="tablist"
      aria-label="Delivery schedule day picker"
    >
      {days.map(d => {
        const iso = toIsoDate(d);
        const isSelected = iso === selectedIso;
        const isToday = iso === today;
        const c = counts[iso] || { orders: 0, loads: 0 };
        const wd = d.toLocaleDateString("en-US", { weekday: "short" });
        const dom = d.getDate();
        const mon = d.toLocaleDateString("en-US", { month: "short" });
        return (
          <button
            key={iso}
            type="button"
            data-selected={isSelected ? "true" : undefined}
            role="tab"
            aria-selected={isSelected}
            aria-label={`${d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}, ${c.orders} orders, ${c.loads} loads`}
            onClick={() => onSelectDate(d)}
            style={{
              flex: "0 0 auto",
              minWidth: 76,
              padding: "8px 6px",
              borderRadius: 10,
              border: `1px solid ${isSelected ? BRAND_NAVY : "#E5E7EB"}`,
              background: isSelected ? BRAND_NAVY : "#FFFFFF",
              color: isSelected ? "#FFFFFF" : "#0D2137",
              cursor: "pointer",
              boxShadow: isToday && !isSelected ? `inset 0 0 0 2px ${BRAND_GOLD}` : "none",
              transition: "background 150ms ease, border-color 150ms ease",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.8 }}>
              {wd}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.1, marginTop: 2 }}>{dom}</div>
            <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>{mon}</div>
            <div
              style={{
                fontSize: 10,
                marginTop: 4,
                fontWeight: 600,
                color: isSelected ? "#FFFFFF" : c.orders > 0 ? BRAND_GOLD : "#9CA3AF",
              }}
            >
              {c.orders > 0 ? `${c.orders} • ${c.loads}Y` : "—"}
            </div>
          </button>
        );
      })}
    </div>
  );
}
