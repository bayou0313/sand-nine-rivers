import { deriveDisplayStatus, SCHEDULE_STATUS_TOKENS } from "@/lib/schedule-adapter";

const BRAND_GOLD = "#C07A00";

interface OrderLike {
  id: string;
  order_number?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  delivery_address?: string | null;
  delivery_window?: string | null;
  quantity?: number | null;
  price?: number | null;
  payment_method?: string | null;
  payment_status?: string | null;
  status?: string | null;
  delivery_date?: string | null;
  cancelled_at?: string | null;
  pit_id?: string | null;
}

interface Props {
  order: OrderLike;
  onOpen: (id: string) => void;
}

export default function ScheduleOrderCard({ order, onOpen }: Props) {
  const display = deriveDisplayStatus(order);
  const tok = SCHEDULE_STATUS_TOKENS[display];
  const price = Number(order.price) || 0;
  const qty = Number(order.quantity) || 0;
  const paymentLabel = (order.payment_method || "").toUpperCase() || "—";

  return (
    <button
      type="button"
      onClick={() => onOpen(order.id)}
      aria-label={`Open order ${order.order_number || order.id} for ${order.customer_name || "customer"}`}
      style={{
        textAlign: "left",
        width: "100%",
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: 12,
        padding: 14,
        cursor: "pointer",
        transition: "border-color 150ms ease, transform 150ms ease, box-shadow 150ms ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "#0D2137";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 2px 8px rgba(13,33,55,0.08)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "#E5E7EB";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontFamily: "monospace", fontSize: 12, color: BRAND_GOLD, fontWeight: 600 }}>
              {order.order_number || "—"}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "2px 8px",
                borderRadius: 999,
                background: tok.bg,
                color: tok.text,
              }}
            >
              {tok.label}
            </span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#0D2137", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {order.customer_name || "—"}
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {order.delivery_address || "—"}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 11, color: "#6B7280" }}>
            <span>{order.delivery_window || "—"}</span>
            <span>•</span>
            <span>{qty} yard{qty === 1 ? "" : "s"}</span>
            <span>•</span>
            <span>{paymentLabel}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: BRAND_GOLD, lineHeight: 1 }}>
            ${price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>
    </button>
  );
}
