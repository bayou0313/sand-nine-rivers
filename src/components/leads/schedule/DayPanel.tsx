import type { Driver } from "@/components/leads/drivers/types";
import ScheduleOrderCard from "./ScheduleOrderCard";

interface OrderLike {
  id: string;
  delivery_window?: string | null;
  created_at?: string | null;
  [k: string]: any;
}

interface Props {
  date: Date;
  orders: OrderLike[];
  loading: boolean;
  onOpenOrder: (id: string) => void;
  /** Path B Phase 2 — threaded down for Send-to-Driver button on cards. */
  drivers?: Driver[];
  onSendToDriver?: (order: any, driver: Driver) => void;
}

export default function DayPanel({ date, orders, loading, onOpenOrder, drivers = [], onSendToDriver }: Props) {
  const heading = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h3
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#0D2137",
            letterSpacing: "0.02em",
            margin: 0,
          }}
        >
          {heading}
        </h3>
        <span style={{ fontSize: 12, color: "#6B7280" }}>
          {orders.length} {orders.length === 1 ? "order" : "orders"}
        </span>
      </div>

      {loading ? (
        <div
          style={{
            padding: "32px 16px",
            textAlign: "center",
            color: "#9CA3AF",
            fontSize: 13,
          }}
        >
          Loading…
        </div>
      ) : orders.length === 0 ? (
        <div
          style={{
            padding: "32px 16px",
            textAlign: "center",
            color: "#9CA3AF",
            fontSize: 13,
            border: "1px dashed #E5E7EB",
            borderRadius: 8,
          }}
        >
          No deliveries scheduled.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {orders.map(o => (
            <ScheduleOrderCard
              key={o.id}
              order={o}
              onOpen={onOpenOrder}
              drivers={drivers}
              onSendToDriver={onSendToDriver}
            />
          ))}
        </div>
      )}
    </div>
  );
}
