import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { summarizeOrders, toIsoDate } from "@/lib/schedule-adapter";
import WeekStrip from "./WeekStrip";
import DayPanel from "./DayPanel";
import SummaryBar from "./SummaryBar";

interface Props {
  /**
   * Card-click handler: parent should set activePage="all" and selectedOrderId=id
   * to drill into the existing Order Detail side panel (Decision 3).
   */
  onOrderClick: (orderId: string) => void;
}

export default function ScheduleTab({ onOrderClick }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [dayOrders, setDayOrders] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, { orders: number; loads: number }>>({});
  const [loading, setLoading] = useState(false);

  const selectedIso = useMemo(() => toIsoDate(selectedDate), [selectedDate]);

  // Fetch orders for the selected day. Direct supabase read per Decision A
  // (matches existing Schedule pattern; no new leads-auth action).
  const fetchDay = useCallback(async (iso: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("delivery_date", iso)
        .order("delivery_window", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(10000); // defensive cap — Supabase silent 1000-row truncation
      if (error) throw error;
      setDayOrders(data || []);
    } catch (err) {
      console.warn("[ScheduleTab] fetchDay failed:", err);
      setDayOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch order/load counts for the visible 91-day window (7 past + 83 future).
  const fetchWindowCounts = useCallback(async (centerDate: Date) => {
    const start = new Date(centerDate);
    start.setDate(start.getDate() - 7);
    const end = new Date(centerDate);
    end.setDate(end.getDate() + 83);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("delivery_date, quantity")
        .gte("delivery_date", toIsoDate(start))
        .lte("delivery_date", toIsoDate(end))
        .limit(10000); // defensive cap
      if (error) throw error;
      const next: Record<string, { orders: number; loads: number }> = {};
      (data || []).forEach((o: any) => {
        const d = o.delivery_date;
        if (!d) return;
        if (!next[d]) next[d] = { orders: 0, loads: 0 };
        next[d].orders += 1;
        next[d].loads += Number(o.quantity) || 0;
      });
      setCounts(next);
    } catch (err) {
      console.warn("[ScheduleTab] fetchWindowCounts failed:", err);
    }
  }, []);

  useEffect(() => {
    fetchDay(selectedIso);
  }, [selectedIso, fetchDay]);

  // Window counts only need to refresh when the centerpoint shifts. Today is
  // the centerpoint for the lifetime of the mounted tab.
  useEffect(() => {
    fetchWindowCounts(new Date());
  }, [fetchWindowCounts]);

  const summary = useMemo(() => summarizeOrders(dayOrders), [dayOrders]);
  const dateLabel = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#0D2137",
            letterSpacing: "0.02em",
            margin: 0,
          }}
        >
          DELIVERY SCHEDULE
        </h2>
        <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
          Orders by delivery date
        </p>
      </div>

      <WeekStrip selectedDate={selectedDate} onSelectDate={setSelectedDate} counts={counts} />

      <SummaryBar summary={summary} dateLabel={dateLabel} />

      <DayPanel
        date={selectedDate}
        orders={dayOrders}
        loading={loading}
        onOpenOrder={onOrderClick}
      />
    </div>
  );
}
