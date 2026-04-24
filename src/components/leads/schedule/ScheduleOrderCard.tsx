import { MessageCircle } from "lucide-react";
import type { Driver } from "@/components/leads/drivers/types";
import { canSendToDriver } from "@/lib/whatsapp-message";
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
  driver_id?: string | null;
  message_sent_at?: string | null;
  notes?: string | null;
}

interface Props {
  order: OrderLike;
  onOpen: (id: string) => void;
  /** Path B Phase 2 — drivers list (filtered to active by parent). */
  drivers?: Driver[];
  /** Path B Phase 2 — Send to Driver. Opens WhatsApp with prefilled message; operator presses send. */
  onSendToDriver?: (order: any, driver: Driver) => void;
}

export default function ScheduleOrderCard({ order, onOpen, drivers = [], onSendToDriver }: Props) {
  const display = deriveDisplayStatus(order);
  const tok = SCHEDULE_STATUS_TOKENS[display];
  const price = Number(order.price) || 0;
  const qty = Number(order.quantity) || 0;
  const paymentLabel = (order.payment_method || "").toUpperCase() || "—";

  const assignedDriver = order.driver_id ? drivers.find(d => d.id === order.driver_id) || null : null;
  const sendCheck = canSendToDriver(order as any, assignedDriver);
  const lastSent = order.message_sent_at
    ? new Date(order.message_sent_at).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
      })
    : null;

  // Path B Phase 2 — outer card converted from <button> to <div role="button"> so the
  // inner Send-to-Driver <button> is valid HTML. Keyboard handler matches native button:
  // Enter triggers, Space triggers (with preventDefault to suppress page scroll).
  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onOpen(order.id);
    } else if (e.key === " " || e.code === "Space") {
      e.preventDefault();
      onOpen(order.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(order.id)}
      onKeyDown={handleKey}
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
        outline: "none",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#0D2137";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 8px rgba(13,33,55,0.08)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "#E5E7EB";
        (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
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

      {/* Path B Phase 2 — Send to Driver. Opens WhatsApp with prefilled message; operator presses send. */}
      {onSendToDriver && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px dashed #E5E7EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 10, color: "#9CA3AF" }}>
            {lastSent ? `Last sent: ${lastSent}` : "Not sent yet."}
          </span>
          <button
            type="button"
            disabled={!sendCheck.canSend}
            title={sendCheck.reason || ""}
            onClick={(e) => {
              e.stopPropagation();
              if (assignedDriver) onSendToDriver(order as any, assignedDriver);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: ".02em",
              borderRadius: 5,
              border: "none",
              cursor: sendCheck.canSend ? "pointer" : "not-allowed",
              background: sendCheck.canSend ? BRAND_GOLD : "#9CA3AF",
              color: "#FFFFFF",
            }}
          >
            <MessageCircle size={12} />
            Send
          </button>
        </div>
      )}
    </div>
  );
}
