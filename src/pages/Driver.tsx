// Path B Phase 3a — driver portal auth foundation
import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Loader2, AlertCircle, LogOut, Truck, Phone, MapPin, Clock, Package, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatPhone, stripPhone } from "@/lib/format";

const BRAND_NAVY = "#0D2137";
const BRAND_GOLD = "#C07A00";
const ERROR_RED = "#DC2626";
const LABEL_CLS = "font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block";
const INPUT_CLS = "h-12 rounded-lg text-base"; // 16px text on mobile to prevent iOS zoom
const TOKEN_KEY = "driver_session_token";

interface DriverInfo {
  id: string;
  name: string;
  phone: string;
  truck_number: string | null;
}

interface OrderRow {
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
}

export default function Driver() {
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  // Tracks whether the page loaded with a stored token that turned out to be invalid/expired
  const hadStoredTokenRef = useRef<boolean>(!!localStorage.getItem(TOKEN_KEY));
  const [showSignedOutNotice, setShowSignedOutNotice] = useState(false);

  // Login form state
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [formAttempted, setFormAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchOrders = useCallback(async (sessionToken: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("driver-auth", {
        body: { action: "list_my_orders", session_token: sessionToken },
      });
      const errBody: any = (data as any) && (data as any).error ? data : null;
      if (error || errBody) {
        // Token invalid/expired — clear and bounce to login.
        // If the page initially loaded with a stored token (i.e. user thought they were
        // signed in), surface a quiet inline notice on the login screen.
        const wasInitialAttempt = hadStoredTokenRef.current;
        hadStoredTokenRef.current = false;
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setDriver(null);
        setOrders([]);
        if (wasInitialAttempt) setShowSignedOutNotice(true);
        return;
      }
      setDriver((data as any)?.driver || null);
      setOrders(((data as any)?.orders || []) as OrderRow[]);
      hadStoredTokenRef.current = false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Polling closure captures token. When token changes (logout), cleanup clears interval but
  // an in-flight request may still fire with old token — server returns 401 and we reset state
  // on next poll tick. Intentional, not a bug.
  useEffect(() => {
    if (!token) return;
    fetchOrders(token);
    const id = window.setInterval(() => fetchOrders(token), 30_000);
    return () => window.clearInterval(id);
  }, [token, fetchOrders]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setFormAttempted(true);
    setPhoneError(null);
    setPinError(null);

    const phoneDigits = stripPhone(phone);
    let hasError = false;
    if (phoneDigits.length < 10) {
      setPhoneError("Enter a valid phone number");
      hasError = true;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setPinError("PIN must be 4–6 digits");
      hasError = true;
    }
    if (hasError) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("driver-auth", {
        body: { action: "login", phone: phoneDigits, pin },
      });
      const errBody: any = (data as any) && (data as any).error ? data : null;
      if (error || errBody) {
        toast({ title: "Login failed", description: "Invalid credentials", variant: "destructive" });
        return;
      }
      const newToken = (data as any).session_token as string;
      const newDriver = (data as any).driver as DriverInfo;
      localStorage.setItem(TOKEN_KEY, newToken);
      setToken(newToken);
      setDriver(newDriver);
      setPin("");
      setShowSignedOutNotice(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    const t = token;
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setDriver(null);
    setOrders([]);
    if (t) {
      await supabase.functions.invoke("driver-auth", {
        body: { action: "logout", session_token: t },
      }).catch(() => {});
    }
  }

  // ── Login screen ──
  if (!token) {
    const showPhoneError = formAttempted && !!phoneError;
    const showPinError = formAttempted && !!pinError;
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: BRAND_NAVY }}>
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 space-y-4">
          <div className="text-center mb-2">
            <Truck className="w-10 h-10 mx-auto mb-2" style={{ color: BRAND_GOLD }} />
            <h1 className="font-display text-2xl uppercase tracking-wide" style={{ color: BRAND_NAVY }}>
              Driver Portal
            </h1>
            <p className="text-xs text-muted-foreground mt-1">Sign in to view your routes</p>
          </div>

          {showSignedOutNotice && (
            <p className="text-xs text-muted-foreground text-center -mt-1">
              Signed out. Please sign in again.
            </p>
          )}

          <div>
            <Label htmlFor="drv-login-phone" className={LABEL_CLS}>Phone</Label>
            <Input
              id="drv-login-phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              maxLength={14}
              value={phone}
              onChange={(e) => {
                setPhone(formatPhone(e.target.value));
                setPhoneError(null);
                if (showSignedOutNotice) setShowSignedOutNotice(false);
              }}
              placeholder="(504) 555-1234"
              className={`${INPUT_CLS} ${showPhoneError ? "border-2" : ""}`}
              style={showPhoneError ? { borderColor: ERROR_RED } : undefined}
            />
            {showPhoneError && (
              <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: ERROR_RED }}>
                <AlertCircle className="w-3 h-3" />
                {phoneError}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="drv-login-pin" className={LABEL_CLS}>PIN</Label>
            <Input
              id="drv-login-pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="current-password"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ""));
                setPinError(null);
                if (showSignedOutNotice) setShowSignedOutNotice(false);
              }}
              placeholder="••••"
              className={`${INPUT_CLS} ${showPinError ? "border-2" : ""}`}
              style={showPinError ? { borderColor: ERROR_RED } : undefined}
            />
            {showPinError && (
              <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: ERROR_RED }}>
                <AlertCircle className="w-3 h-3" />
                {pinError}
              </div>
            )}
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 font-display uppercase tracking-wide"
            style={{ backgroundColor: BRAND_GOLD, color: "white" }}
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Sign In
          </Button>
        </form>
      </div>
    );
  }

  // ── Authenticated portal ──
  return (
    <div className="min-h-screen bg-gray-50">
      <header
        className="sticky top-0 z-10 px-4 py-3 flex items-center justify-between shadow-md"
        style={{ backgroundColor: BRAND_NAVY }}
      >
        <div className="text-white">
          <div className="font-display uppercase tracking-wide text-base leading-tight">
            {driver?.name || "Driver"}
          </div>
          {driver?.truck_number && (
            <div className="text-xs opacity-80">Truck {driver.truck_number}</div>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleLogout}
          className="text-white hover:bg-white/10"
        >
          <LogOut className="w-4 h-4 mr-1" />
          <span className="text-xs">Sign out</span>
        </Button>
      </header>

      <main className="px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display uppercase tracking-wide text-sm" style={{ color: BRAND_NAVY }}>
            Today &amp; Tomorrow
          </h2>
          {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>

        {orders.length === 0 && !loading && (
          <div className="bg-white rounded-xl p-8 text-center text-sm text-muted-foreground">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No assigned deliveries.
          </div>
        )}

        {orders.map((o) => (
          <div key={o.id} className="bg-white rounded-xl shadow-sm p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-display uppercase tracking-wide text-sm" style={{ color: BRAND_NAVY }}>
                  {o.order_number || o.id.slice(0, 8)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {o.delivery_date || "—"} • {o.quantity} load{o.quantity > 1 ? "s" : ""}
                </div>
              </div>
              <span
                className="text-[10px] uppercase font-semibold px-2 py-1 rounded"
                style={{
                  backgroundColor: o.payment_method === "COD" ? "#FEF3C7" : "#DBEAFE",
                  color: o.payment_method === "COD" ? "#92400E" : "#1E40AF",
                }}
              >
                {o.payment_method}
              </span>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <span>{o.delivery_address}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                <span>{o.delivery_window}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                <a href={`tel:${o.customer_phone}`} className="text-blue-600 underline">
                  {formatPhone(o.customer_phone)}
                </a>
                <span className="text-muted-foreground">— {o.customer_name}</span>
              </div>
              {o.notes && (
                <div className="text-xs bg-yellow-50 border border-yellow-200 rounded p-2 mt-2">
                  {o.notes}
                </div>
              )}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
