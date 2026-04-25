// Path B Phase 3b — driver order detail + workflow actions
//
// Single-order view + 4-state workflow machine:
//   NULL → acknowledged → at_pit → loaded → delivered
// No skipping, no re-entering. COD payment must be recorded before
// the loaded → delivered transition. UI also enforces a client-side parity
// gate (collected sum >= price) BEFORE the Delivered button is enabled.
// SECURITY NOTE: That parity gate is UI-only. The server (advance_workflow)
// only checks driver_collected_at !== null. See SECURITY_ROADMAP.md §2.5
// for the threat model and planned server-side enforcement.
//
// Data flow: get_order on mount, then optimistic UI on each action with
// rollback on server failure. All three workflow endpoints return the
// SAME column set (mirror SELECT discipline); the embedded pit:pits(name)
// join survives server round-trips so we never have to manually preserve
// fields across responses.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  Loader2, AlertCircle, ArrowLeft, MapPin, Clock, Phone, Package,
  CheckCircle2, Circle, DollarSign, Truck, Navigation,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatPhone } from "@/lib/format";

// Brand constants — match Driver.tsx convention.
// NOTE: When the design system gets centralized (post-fleetwork migration),
// move these to src/lib/constants.ts or Tailwind semantic tokens. Out of
// scope for Phase 3b — see review notes.
const BRAND_NAVY = "#0D2137";
const BRAND_GOLD = "#C07A00";
const ERROR_RED = "#DC2626";
const SUCCESS_GREEN = "#16A34A";
const TOKEN_KEY = "driver_session_token";

// Workflow states in order. Index = step number.
const WORKFLOW_STEPS = ["acknowledged", "at_pit", "loaded", "delivered"] as const;
type WorkflowState = typeof WORKFLOW_STEPS[number];

const STEP_LABELS: Record<WorkflowState, string> = {
  acknowledged: "Acknowledged",
  at_pit:       "Arrived at PIT",
  loaded:       "Loaded",
  delivered:    "Delivered",
};

const STEP_BUTTONS: Record<WorkflowState, string> = {
  acknowledged: "Acknowledge",
  at_pit:       "Arrived at PIT",
  loaded:       "Mark loaded",
  delivered:    "Mark delivered",
};

interface OrderDetail {
  id: string;
  order_number: string | null;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_window: string;
  delivery_date: string | null;
  quantity: number;
  price: number;
  payment_method: string;
  payment_status: string;
  notes: string | null;
  driver_workflow_status: WorkflowState | null;
  acknowledged_at: string | null;
  at_pit_at: string | null;
  loaded_at: string | null;
  workflow_delivered_at: string | null;
  driver_collected_cash: number | null;
  driver_collected_check: number | null;
  driver_collected_card: number | null;
  driver_collected_at: string | null;
  pit_id: string | null;
  pit: { name: string } | null;
}

// COD detection: any order not Stripe-paid is treated as COD. This mirrors
// the server-side gate in advance_workflow exactly (which only bypasses the
// payment requirement when payment_status === "paid"). Do NOT gate on
// payment_method — production values are "cash" / "stripe-link", not "cod_*".
// See brief Mismatch #3 resolution + SECURITY_ROADMAP.md §2.5.

function nextState(current: WorkflowState | null): WorkflowState | null {
  if (current === null) return "acknowledged";
  const i = WORKFLOW_STEPS.indexOf(current);
  if (i < 0 || i >= WORKFLOW_STEPS.length - 1) return null;
  return WORKFLOW_STEPS[i + 1];
}

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  // Locale time. Server clocks may drift slightly from device clocks; this is
  // a display-only stamp and does not feed any business logic.
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function fmtMoney(n: number | null | undefined): string {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return `$${v.toFixed(2)}`;
}

export default function DriverOrder() {
  const { id: orderId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

  // COD form state — pre-seeded from order on load to prevent accidental
  // overwrite. Replacement semantics: the form represents the row state, not
  // a delta. Saving overwrites the previous values.
  const [cashStr, setCashStr] = useState("");
  const [checkStr, setCheckStr] = useState("");
  const [cardStr, setCardStr] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  // Track unsaved local edits to the COD form so we can show the
  // "Tap Save Totals above" hint when parity is met locally but unsaved.
  const codFormDirtyRef = useRef(false);

  // ── Auth gate: bounce to /driver if no session token ──
  useEffect(() => {
    if (!token) navigate("/driver", { replace: true });
  }, [token, navigate]);

  const loadOrder = useCallback(async () => {
    if (!token || !orderId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("driver-auth", {
        body: { action: "get_order", session_token: token, order_id: orderId },
      });
      const errBody: any = (data as any) && (data as any).error ? data : null;
      if (error || errBody) {
        const msg = errBody?.error || "Failed to load order";
        // 401 → token expired; bounce to login. The list page handles the
        // "signed out" notice via its own polling logic.
        if (msg === "Unauthorized") {
          localStorage.removeItem(TOKEN_KEY);
          navigate("/driver", { replace: true });
          return;
        }
        setErrorMsg(msg);
        setOrder(null);
        return;
      }
      const o = (data as any)?.order as OrderDetail | undefined;
      if (!o || typeof o !== "object" || !o.id) {
        // Defensive: if the contract drifts and we get an unexpected shape,
        // log it (future debugging insurance) and surface a generic error.
        console.warn("get_order: unexpected response shape", data);
        setErrorMsg("Order not found or not assigned to you");
        setOrder(null);
        return;
      }
      setOrder(o);
      // Pre-seed COD form with current row state.
      setCashStr(o.driver_collected_cash != null ? String(o.driver_collected_cash) : "");
      setCheckStr(o.driver_collected_check != null ? String(o.driver_collected_check) : "");
      setCardStr(o.driver_collected_card != null ? String(o.driver_collected_card) : "");
      codFormDirtyRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [token, orderId, navigate]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  // ── Derived state ──
  const current = order?.driver_workflow_status ?? null;
  const next = nextState(current);
  const isTerminal = current === "delivered";

  const cash = useMemo(() => parseFloat(cashStr || "0") || 0, [cashStr]);
  const check = useMemo(() => parseFloat(checkStr || "0") || 0, [checkStr]);
  const card = useMemo(() => parseFloat(cardStr || "0") || 0, [cardStr]);
  const collectedSum = cash + check + card;

  const stripePaid = order?.payment_status === "paid";
  const codOrder = order ? !stripePaid : false;
  const meetsParity = order ? collectedSum >= order.price : false;
  const paymentSavedToServer = !!order?.driver_collected_at;

  // Server gate (mirror): can the driver advance from loaded → delivered?
  // Server only checks driver_collected_at !== null OR payment_status === "paid".
  const canAdvanceLoaded = stripePaid || paymentSavedToServer;

  // UI parity gate (stricter — see §2.5): for COD, also require collected sum >= price.
  const uiCanMarkDelivered = !codOrder || stripePaid || (paymentSavedToServer && meetsParity);

  // ── Workflow advance ──
  async function handleAdvance() {
    if (!order || !next || advancing) return;
    if (!token) return;

    // Optimistic update — flip status + stamp timestamp client-side.
    const previous = order;
    const stampField = (
      next === "acknowledged" ? "acknowledged_at" :
      next === "at_pit"       ? "at_pit_at" :
      next === "loaded"       ? "loaded_at" :
                                "workflow_delivered_at"
    ) as keyof OrderDetail;
    setOrder({
      ...order,
      driver_workflow_status: next,
      [stampField]: new Date().toISOString(),
    } as OrderDetail);
    setAdvancing(true);

    try {
      const { data, error } = await supabase.functions.invoke("driver-auth", {
        body: {
          action: "advance_workflow",
          session_token: token,
          order_id: order.id,
          to_status: next,
        },
      });
      const errBody: any = (data as any) && (data as any).error ? data : null;
      if (error || errBody) {
        // Roll back optimistic update.
        setOrder(previous);
        const msg = errBody?.error || "Failed to update";
        toast({ title: "Couldn't advance", description: msg, variant: "destructive" });
        return;
      }
      const updated = (data as any)?.order as OrderDetail | undefined;
      if (updated && updated.id) {
        // Server returns full SELECT (mirror) — pit join included. Replace whole order.
        setOrder(updated);
      } else {
        console.warn("advance_workflow: unexpected response shape", data);
      }
      toast({ title: STEP_LABELS[next], description: "Saved." });
    } finally {
      setAdvancing(false);
    }
  }

  // ── Record payment ──
  async function handleSavePayment() {
    if (!order || savingPayment) return;
    if (!token) return;

    // Validate locally before round-trip.
    const validate = (s: string): number | null => {
      if (s.trim() === "") return 0;
      const n = parseFloat(s);
      if (!Number.isFinite(n) || n < 0) return null;
      return n;
    };
    const cashV = validate(cashStr);
    const checkV = validate(checkStr);
    const cardV = validate(cardStr);
    if (cashV === null || checkV === null || cardV === null) {
      toast({
        title: "Invalid amount",
        description: "Enter non-negative numbers only.",
        variant: "destructive",
      });
      return;
    }

    setSavingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke("driver-auth", {
        body: {
          action: "record_payment_collected",
          session_token: token,
          order_id: order.id,
          cash: cashV,
          check: checkV,
          card: cardV,
        },
      });
      const errBody: any = (data as any) && (data as any).error ? data : null;
      if (error || errBody) {
        const msg = errBody?.error || "Failed to save";
        toast({ title: "Couldn't save totals", description: msg, variant: "destructive" });
        return;
      }
      const updated = (data as any)?.order as OrderDetail | undefined;
      if (updated && updated.id) {
        setOrder(updated);
        codFormDirtyRef.current = false;
        toast({ title: "Totals saved", description: `Recorded at ${fmtTime(updated.driver_collected_at)}` });
      } else {
        console.warn("record_payment_collected: unexpected response shape", data);
      }
    } finally {
      setSavingPayment(false);
    }
  }

  // ── Render guards ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: BRAND_NAVY }}>
        <Loader2 className="w-6 h-6 animate-spin text-white" />
      </div>
    );
  }
  if (errorMsg || !order) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-6">
        <Link to="/driver" className="inline-flex items-center gap-1 text-sm mb-4" style={{ color: BRAND_NAVY }}>
          <ArrowLeft className="w-4 h-4" /> Back to orders
        </Link>
        <div className="bg-white rounded-xl p-6 text-center space-y-2">
          <AlertCircle className="w-8 h-8 mx-auto" style={{ color: ERROR_RED }} />
          <p className="text-sm text-muted-foreground">
            {errorMsg || "Order not found or not assigned to you"}
          </p>
        </div>
      </div>
    );
  }

  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.delivery_address)}`;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header
        className="sticky top-0 z-10 px-4 py-3 flex items-center gap-2 shadow-md"
        style={{ backgroundColor: BRAND_NAVY }}
      >
        <Link to="/driver" className="text-white p-1 -ml-1" aria-label="Back to orders">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="text-white min-w-0 flex-1">
          <div className="font-display uppercase tracking-wide text-base leading-tight truncate">
            {order.order_number || order.id.slice(0, 8)}
          </div>
          <div className="text-xs opacity-80">
            {order.delivery_date || "—"} • {order.delivery_window}
          </div>
        </div>
        <span
          className="text-[10px] uppercase font-semibold px-2 py-1 rounded"
          style={{
            backgroundColor: codOrder ? "#FEF3C7" : "#DBEAFE",
            color: codOrder ? "#92400E" : "#1E40AF",
          }}
        >
          {order.payment_method}
        </span>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Customer + delivery */}
        <section className="bg-white rounded-xl shadow-sm p-4 space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
            <div className="flex-1">
              <div>{order.delivery_address}</div>
              <a
                href={directionsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 underline mt-1"
              >
                <Navigation className="w-3 h-3" /> Open in Maps
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
            <span>{order.delivery_window}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
            <a href={`tel:${order.customer_phone}`} className="text-blue-600 underline">
              {formatPhone(order.customer_phone)}
            </a>
            <span className="text-muted-foreground">— {order.customer_name}</span>
          </div>
          {order.notes && (
            <div className="text-xs bg-yellow-50 border border-yellow-200 rounded p-2 mt-1">
              {order.notes}
            </div>
          )}
        </section>

        {/* Order items */}
        <section className="bg-white rounded-xl shadow-sm p-4 space-y-2">
          <h3 className="font-display uppercase tracking-wide text-xs" style={{ color: BRAND_NAVY }}>
            Order
          </h3>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sand type</span>
              {/* Single-SKU business as of 2026-04. If orders.product_type column
                  is added, replace with order.product_type. */}
              <span className="font-medium">River Sand</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Yards</span>
              <span className="font-medium">{order.quantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pit assigned</span>
              <span className="font-medium">{order.pit?.name || "—"}</span>
            </div>
            <div className="flex justify-between pt-1 border-t mt-2">
              <span className="text-muted-foreground">Total due</span>
              <span className="font-display text-lg" style={{ color: BRAND_NAVY }}>
                {fmtMoney(order.price)}
              </span>
            </div>
          </div>
        </section>

        {/* Workflow tracker */}
        <section className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-display uppercase tracking-wide text-xs" style={{ color: BRAND_NAVY }}>
            Workflow
          </h3>
          <ol className="space-y-2">
            {WORKFLOW_STEPS.map((step) => {
              const stepIdx = WORKFLOW_STEPS.indexOf(step);
              const currentIdx = current ? WORKFLOW_STEPS.indexOf(current) : -1;
              const done = currentIdx >= stepIdx;
              const ts =
                step === "acknowledged" ? order.acknowledged_at :
                step === "at_pit"       ? order.at_pit_at :
                step === "loaded"       ? order.loaded_at :
                                          order.workflow_delivered_at;
              return (
                <li key={step} className="flex items-center gap-2 text-sm">
                  {done ? (
                    <CheckCircle2 className="w-4 h-4" style={{ color: SUCCESS_GREEN }} />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className={done ? "font-medium" : "text-muted-foreground"}>
                    {STEP_LABELS[step]}
                  </span>
                  {ts && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {fmtTime(ts)}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        {/* COD payment form — only relevant once at_pit, hidden for Stripe-paid */}
        {codOrder && current === "at_pit" && (
          <section className="bg-white rounded-xl shadow-sm p-4 space-y-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" style={{ color: BRAND_GOLD }} />
              <h3 className="font-display uppercase tracking-wide text-xs" style={{ color: BRAND_NAVY }}>
                Total COD collected
              </h3>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              Enter the running total collected so far. Saving overwrites the previous values.
            </p>

            <div className="space-y-2">
              <div>
                <Label htmlFor="cod-cash" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Total cash
                </Label>
                <Input
                  id="cod-cash"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={cashStr}
                  onChange={(e) => { setCashStr(e.target.value); codFormDirtyRef.current = true; }}
                  placeholder="0.00"
                  className="h-12 text-base"
                />
              </div>
              <div>
                <Label htmlFor="cod-check" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Total check
                </Label>
                <Input
                  id="cod-check"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={checkStr}
                  onChange={(e) => { setCheckStr(e.target.value); codFormDirtyRef.current = true; }}
                  placeholder="0.00"
                  className="h-12 text-base"
                />
              </div>
              <div>
                <Label htmlFor="cod-card" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Total card
                </Label>
                <Input
                  id="cod-card"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={cardStr}
                  onChange={(e) => { setCardStr(e.target.value); codFormDirtyRef.current = true; }}
                  placeholder="0.00"
                  className="h-12 text-base"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm pt-1 border-t">
              <span className="text-muted-foreground">Collected</span>
              <span
                className="font-display text-base"
                style={{ color: meetsParity ? SUCCESS_GREEN : BRAND_NAVY }}
              >
                {fmtMoney(collectedSum)} / {fmtMoney(order.price)}
              </span>
            </div>

            {paymentSavedToServer && (
              <div className="text-[11px] text-muted-foreground">
                Last saved {fmtTime(order.driver_collected_at)}
              </div>
            )}

            <Button
              type="button"
              onClick={handleSavePayment}
              disabled={savingPayment}
              className="w-full h-12 font-display uppercase tracking-wide"
              style={{ backgroundColor: BRAND_GOLD, color: "white" }}
            >
              {savingPayment && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Totals
            </Button>
          </section>
        )}

        {/* Workflow action button */}
        {!isTerminal && next && (
          <section className="bg-white rounded-xl shadow-sm p-4 space-y-2">
            {/* Two-hint split: not at parity vs at parity but unsaved */}
            {next === "loaded" && codOrder && !stripePaid && !meetsParity && (
              <div className="flex items-start gap-2 text-xs" style={{ color: ERROR_RED }}>
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Collect payment in full before marking Loaded.</span>
              </div>
            )}
            {next === "loaded" && codOrder && !stripePaid && meetsParity && !paymentSavedToServer && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Tap Save Totals above to record before marking Loaded.</span>
              </div>
            )}

            <Button
              type="button"
              onClick={handleAdvance}
              disabled={
                advancing ||
                (next === "loaded" && !uiCanMarkLoaded) ||
                (next === "loaded" && !canAdvanceAtPit)
              }
              className="w-full h-14 font-display uppercase tracking-wide text-base"
              style={{ backgroundColor: BRAND_GOLD, color: "white" }}
            >
              {advancing && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
              {next === "at_pit" && <Truck className="w-5 h-5 mr-2" />}
              {next === "loaded" && <Package className="w-5 h-5 mr-2" />}
              {next === "delivered" && <CheckCircle2 className="w-5 h-5 mr-2" />}
              {STEP_BUTTONS[next]}
            </Button>
          </section>
        )}

        {isTerminal && (
          <section className="bg-white rounded-xl shadow-sm p-6 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 mx-auto" style={{ color: SUCCESS_GREEN }} />
            <div className="font-display uppercase tracking-wide" style={{ color: BRAND_NAVY }}>
              Delivered
            </div>
            {order.workflow_delivered_at && (
              <div className="text-xs text-muted-foreground">
                Completed at {fmtTime(order.workflow_delivered_at)}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
