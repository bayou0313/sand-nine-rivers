import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Driver } from "@/components/leads/drivers/types";
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
  /** Path B Phase 2 — drivers list lifted from Leads.tsx, threaded for Send-to-Driver button. */
  drivers?: Driver[];
  /** Path B Phase 2 — Send to Driver. Opens WhatsApp with prefilled message; operator presses send. */
  onSendToDriver?: (order: any, driver: Driver) => void;
}

export default function ScheduleTab({ onOrderClick, drivers = [], onSendToDriver }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [dayOrders, setDayOrders] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, { orders: number; loads: number }>>({});
  const [loading, setLoading] = useState(false);

  const selectedIso = useMemo(() => toIsoDate(selectedDate), [selectedDate]);

  // Correction to Slice 1 — Schedule reads now route through leads-auth, not direct supabase.from().
  // Original Decision A assumed the direct read pattern worked; diagnosis revealed the orders table
  // RLS policy (admins_read_all_orders) requires an authenticated admin JWT, but /leads sessions
  // hold only a sessionStorage password and query as the anon role. Anon reads were silently
  // filtered to []. All other Leads tabs already route through leads-auth — this aligns Schedule
  // with that pattern.
  const fetchDay = useCallback(async (iso: string) => {
    setLoading(true);
    try {
      const password = sessionStorage.getItem("leads_pw") || "";
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: { action: "schedule_get_day", password, iso },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDayOrders(data?.orders || []);
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
      const password = sessionStorage.getItem("leads_pw") || "";
      const { data, error } = await supabase.functions.invoke("leads-auth", {
        body: {
          action: "schedule_get_window_counts",
          password,
          start: toIsoDate(start),
          end: toIsoDate(end),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const next: Record<string, { orders: number; loads: number }> = {};
      (data?.rows || []).forEach((o: any) => {
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

  // Path B Phase 2 — Send to Driver from a Schedule card. Optimistically patch local
  // dayOrders so "Last sent" updates immediately; parent owns the persistent allOrders
  // patch + revert-on-failure flow.
  const handleCardSend = useCallback((order: any, driver: Driver) => {
    if (!onSendToDriver) return;
    const iso = new Date().toISOString();
    setDayOrders(prev => prev.map(o => o.id === order.id ? { ...o, message_sent_at: iso } : o));
    onSendToDriver(order, driver);
  }, [onSendToDriver]);

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
        drivers={drivers}
        onSendToDriver={onSendToDriver ? handleCardSend : undefined}
      />
    </div>
  );
}
