// Path B Phase 3a — driver portal auth foundation
// Public endpoint (no JWT). Validates phone + bcrypted PIN. Issues 30-day session
// tokens. Mirrors the leads-auth structure: single entrypoint, action verb dispatch,
// service-role supabase client, generic error messages to prevent enumeration.
//
// Actions: login, logout, list_my_orders, get_order, advance_workflow, record_payment_collected
// Internal helper: verify_session (not exposed as a public action)
//
// Security:
// - bcryptjs@2.4.3 cost 10 (matches existing 2FA backup-code pattern in leads-auth)
// - Session tokens: 32 random bytes, base64url (RFC 4648 §5) for return; SHA-256 hash stored
// - Generic "Invalid credentials" for both missing phone and wrong PIN
// - In-memory rate limit: 5 attempts per 60s per IP, non-functional in production
//   (Supabase isolate boots reset the counter on nearly every request — see
//   SECURITY_ROADMAP.md §1.4; DB-backed limiter scheduled for Phase 3b+1)
// - Session tokens never logged anywhere

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const ALLOWED_ORIGINS = [
  "https://riversand.net",
  "https://www.riversand.net",
  "https://fleetwork.net",
  "https://www.fleetwork.net",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
];

function isAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.endsWith(".lovable.app") && origin.startsWith("https://")) return true;
  return false;
}

function corsFor(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (isAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin!;
  }
  return headers;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ─────────────────────────────────────────────────────────────────────────────
// Token helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Encode bytes as base64url per RFC 4648 §5 (URL-safe alphabet, no padding).
 * Avoids future bugs if tokens ever land in URL params or cookie names.
 */
function base64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** SHA-256 hash → lowercase hex string. */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** 32 random bytes → base64url. Returned to client ONCE; never re-emitted. */
function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}

// ─────────────────────────────────────────────────────────────────────────────
// In-memory rate limit (5 attempts / 60s / IP)
//
// STATUS (verified 2026-04-25): non-functional in production — in-memory
// limiter does not survive Supabase isolate boots; effective rate is
// ~14 attempts/sec/IP gated only by bcrypt latency. Scheduled fix: Phase 3b+1
// (DB-backed `driver_login_attempts` table with `(ip_address, attempted_at)`
// index, server-side count check before bcrypt comparison, ~30–45 min slice).
//
// See SECURITY_ROADMAP.md §2 Priority 1 for matching language and roadmap entry.
// ─────────────────────────────────────────────────────────────────────────────

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 5;
const rateMap = new Map<string, number[]>();

function checkRate(ip: string): boolean {
  const now = Date.now();
  const arr = (rateMap.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    rateMap.set(ip, arr);
    return false;
  }
  arr.push(now);
  rateMap.set(ip, arr);
  return true;
}

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  return xff.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
// Session verification (internal — not a public action verb)
// Checks: hash match + expires_at > now() + revoked_at IS NULL
// On hit, also bumps last_active_at.
// Returns driver_id or null.
// ─────────────────────────────────────────────────────────────────────────────

async function verifySession(
  supabase: ReturnType<typeof createClient>,
  rawToken: string,
): Promise<string | null> {
  if (!rawToken || typeof rawToken !== "string") return null;
  const tokenHash = await sha256Hex(rawToken);
  const { data, error } = await supabase
    .from("driver_sessions")
    .select("id, driver_id, expires_at, revoked_at")
    .eq("session_token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();
  if (error || !data) return null;
  if (new Date(data.expires_at as string).getTime() <= Date.now()) return null;

  // Bump last_active_at (fire-and-forget; failure here doesn't invalidate the session)
  await supabase
    .from("driver_sessions")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", data.id);

  return data.driver_id as string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entrypoint
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  const cors = corsFor(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const action = body?.action;
  const ip = getClientIp(req);

  // ── LOGIN ──
  if (action === "login") {
    if (!checkRate(ip)) {
      return new Response(
        JSON.stringify({ error: "Too many attempts. Try again in a minute." }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const phoneRaw = typeof body.phone === "string" ? body.phone : "";
    const pin = typeof body.pin === "string" ? body.pin : "";
    const phoneDigits = phoneRaw.replace(/\D/g, "");

    // Generic credential validation. Format errors return the same generic
    // message as bad credentials to avoid leaking which check failed.
    if (!phoneDigits || !/^\d{4,6}$/.test(pin)) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Loads all active drivers for in-memory digits comparison. Fine at <50 drivers.
    // Revisit if fleet scales past 100 — consider generated phone_digits column or
    // upsert-time normalization.
    const { data: drivers, error: dErr } = await supabase
      .from("drivers")
      .select("id, name, phone, truck_number, pin_hash")
      .eq("active", true);

    if (dErr) {
      return new Response(JSON.stringify({ error: "Login failed" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const driver = (drivers || []).find(
      (d: any) => String(d.phone || "").replace(/\D/g, "") === phoneDigits,
    );

    // Constant-ish path: if no driver, still call bcrypt against a fixed hash
    // to keep timing roughly even and avoid enumeration via response time.
    const DUMMY_HASH = "$2a$10$abcdefghijklmnopqrstuuW7eZpD7vO6/xQBmF8Yf4W9p3xJ2dJ8i";
    if (!driver || !driver.pin_hash) {
      await bcrypt.compare(pin, DUMMY_HASH).catch(() => false);
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const ok = await bcrypt.compare(pin, driver.pin_hash);
    if (!ok) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Issue session
    const rawToken = generateSessionToken();
    const tokenHash = await sha256Hex(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const userAgent = req.headers.get("user-agent") || null;

    const { error: insErr } = await supabase.from("driver_sessions").insert({
      driver_id: driver.id,
      session_token_hash: tokenHash,
      expires_at: expiresAt,
      ip_address: ip === "unknown" ? null : ip,
      user_agent: userAgent,
    });

    if (insErr) {
      return new Response(JSON.stringify({ error: "Login failed" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("drivers")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", driver.id);

    return new Response(
      JSON.stringify({
        session_token: rawToken,
        driver: {
          id: driver.id,
          name: driver.name,
          phone: driver.phone,
          truck_number: driver.truck_number,
        },
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // ── LOGOUT ──
  // Logout is intentionally idempotent — always returns 200 regardless of whether
  // the token was valid. Prevents token-existence enumeration.
  if (action === "logout") {
    const rawToken = typeof body.session_token === "string" ? body.session_token : "";
    if (!rawToken) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const tokenHash = await sha256Hex(rawToken);
    await supabase
      .from("driver_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("session_token_hash", tokenHash)
      .is("revoked_at", null);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ── LIST MY ORDERS ──
  if (action === "list_my_orders") {
    const rawToken = typeof body.session_token === "string" ? body.session_token : "";
    const driverId = await verifySession(supabase, rawToken);
    if (!driverId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // today + tomorrow (driver's local day window — server uses UTC date strings;
    // delivery_date is a DATE column so timezone slop is bounded to ±1 day at most.
    // Phase 3b will revisit with an explicit operator timezone setting.)
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    // Fetch driver record alongside orders so the client can rehydrate the
    // header bar after a page refresh without a separate verify call.
    const [driverRes, ordersRes] = await Promise.all([
      supabase
        .from("drivers")
        .select("id, name, phone, truck_number")
        .eq("id", driverId)
        .maybeSingle(),
      supabase
        .from("orders")
        .select(
          "id, order_number, customer_name, customer_phone, delivery_address, delivery_window, delivery_date, quantity, price, payment_method, payment_status, notes, driver_workflow_status, acknowledged_at, at_pit_at, loaded_at, workflow_delivered_at, driver_collected_cash, driver_collected_check, driver_collected_card, driver_collected_at, pit_id, pit:pits(name)",
        )
        .eq("driver_id", driverId)
        .gte("delivery_date", fmt(today))
        .lte("delivery_date", fmt(tomorrow))
        .order("delivery_date", { ascending: true })
        .order("delivery_window", { ascending: true }),
    ]);

    if (ordersRes.error || driverRes.error) {
      if (ordersRes.error) console.error("[list_my_orders] orders error:", ordersRes.error);
      if (driverRes.error) console.error("[list_my_orders] driver error:", driverRes.error);
      return new Response(JSON.stringify({ error: "Failed to load orders" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        driver: driverRes.data || null,
        orders: ordersRes.data || [],
      }),
      {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }

  // ── GET ORDER (single) ──
  // Path B Phase 3b — driver order detail view.
  // Returns the same column set as list_my_orders for one order, scoped to the
  // calling driver. Uses 404 "Order not found" for both missing-id and
  // wrong-driver cases to prevent enumeration of other drivers' orders.
  // The driver_id column is fetched server-side for the ownership check but
  // stripped from the response payload — clients never need it.
  if (action === "get_order") {
    const rawToken = typeof body.session_token === "string" ? body.session_token : "";
    const driverId = await verifySession(supabase, rawToken);
    if (!driverId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const orderId = typeof body.order_id === "string" ? body.order_id : "";
    if (!orderId) {
      return new Response(JSON.stringify({ error: "Order not found or not assigned to you" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select(
        "id, driver_id, order_number, customer_name, customer_phone, delivery_address, delivery_window, delivery_date, quantity, price, payment_method, payment_status, notes, driver_workflow_status, acknowledged_at, at_pit_at, loaded_at, workflow_delivered_at, driver_collected_cash, driver_collected_check, driver_collected_card, driver_collected_at, pit_id, pit:pits(name)",
      )
      .eq("id", orderId)
      .maybeSingle();

    if (fetchErr || !order || order.driver_id !== driverId) {
      if (fetchErr) console.error("[get_order] fetch error:", fetchErr);
      // Generic 404 for missing OR not-yours, to match anti-enumeration pattern
      // used by advance_workflow / record_payment_collected.
      return new Response(JSON.stringify({ error: "Order not found or not assigned to you" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Strip driver_id before returning — client doesn't need it.
    const { driver_id: _drop, ...safeOrder } = order as Record<string, unknown>;

    return new Response(JSON.stringify({ order: safeOrder }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ── ADVANCE WORKFLOW ──
  // Path B Phase 3b — driver workflow states + payment capture
  // Strict state machine: NULL → acknowledged → at_pit → loaded → delivered.
  // No skipping. No re-entering. Payment must be recorded (or Stripe-paid) before
  // at_pit → loaded. Ownership enforced server-side: driver must own the order.
  if (action === "advance_workflow") {
    const rawToken = typeof body.session_token === "string" ? body.session_token : "";
    const driverId = await verifySession(supabase, rawToken);
    if (!driverId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const orderId = typeof body.order_id === "string" ? body.order_id : "";
    const newStatus = typeof body.to_status === "string" ? body.to_status : "";

    // Strict whitelist — exact match against the four legal states.
    const VALID_STATES = ["acknowledged", "at_pit", "loaded", "delivered"] as const;
    type WorkflowState = typeof VALID_STATES[number];
    if (!orderId || !VALID_STATES.includes(newStatus as WorkflowState)) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Fetch order with ownership + state + payment context in one query.
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("id, driver_id, driver_workflow_status, payment_status, driver_collected_at")
      .eq("id", orderId)
      .maybeSingle();

    if (fetchErr || !order) {
      // Generic message — do not leak whether the order exists or just isn't ours.
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Ownership check. Same generic 404 to prevent enumeration of other drivers' orders.
    if (order.driver_id !== driverId) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // State machine: legal next-state for the current state.
    // Map current → only allowed next. Anything else is rejected.
    const legalNext: Record<string, WorkflowState> = {
      "":              "acknowledged", // sentinel for NULL (handled below)
      "acknowledged":  "at_pit",
      "at_pit":        "loaded",
      "loaded":        "delivered",
    };
    const currentKey = order.driver_workflow_status ?? "";
    const allowedNext = legalNext[currentKey];

    // Terminal state ('delivered') has no entry in legalNext → allowedNext undefined → reject.
    // Same-state-to-same-state ('acknowledged' → 'acknowledged') also rejected because
    // legalNext['acknowledged'] = 'at_pit', not 'acknowledged'.
    if (!allowedNext || allowedNext !== newStatus) {
      return new Response(JSON.stringify({ error: "Cannot skip workflow steps" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Payment gate: at_pit → loaded requires either recorded payment OR Stripe-paid.
    // OR semantics: payment_status === "paid" (Stripe orders) bypasses cash recording.
    // For COD orders, driver_collected_at must be non-null.
    if (currentKey === "at_pit" && newStatus === "loaded") {
      const isStripePaid = order.payment_status === "paid";
      const paymentRecorded = order.driver_collected_at !== null;
      if (!isStripePaid && !paymentRecorded) {
        return new Response(
          JSON.stringify({ error: "Record payment before continuing" }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
    }

    // Map newStatus → which timestamp column gets stamped.
    const timestampCol: Record<WorkflowState, string> = {
      "acknowledged": "acknowledged_at",
      "at_pit":       "at_pit_at",
      "loaded":       "loaded_at",
      "delivered":    "workflow_delivered_at",
    };
    const stampCol = timestampCol[newStatus as WorkflowState];

    const update: Record<string, unknown> = {
      driver_workflow_status: newStatus,
      [stampCol]: new Date().toISOString(),
    };

    const { data: updated, error: updateErr } = await supabase
      .from("orders")
      .update(update)
      .eq("id", orderId)
      .eq("driver_id", driverId) // belt + suspenders: ownership re-asserted in WHERE
      .select(
        "id, order_number, customer_name, customer_phone, delivery_address, delivery_window, delivery_date, quantity, price, payment_method, payment_status, notes, driver_workflow_status, acknowledged_at, at_pit_at, loaded_at, workflow_delivered_at, driver_collected_cash, driver_collected_check, driver_collected_card, driver_collected_at, pit_id, pit:pits(name)",
      )
      .maybeSingle();

    if (updateErr || !updated) {
      return new Response(JSON.stringify({ error: "Failed to update order" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ order: updated }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ── RECORD PAYMENT COLLECTED ──
  // Path B Phase 3b — driver workflow states + payment capture
  // Driver records cash/check/card amounts at the at_pit step. Allowed only when
  // the order is currently at_pit — not before, not after. Non-negative numbers
  // only. Zero is acceptable in any field. Negative / NaN / Infinity / non-number
  // rejected.
  if (action === "record_payment_collected") {
    const rawToken = typeof body.session_token === "string" ? body.session_token : "";
    const driverId = await verifySession(supabase, rawToken);
    if (!driverId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const orderId = typeof body.order_id === "string" ? body.order_id : "";
    if (!orderId) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Strict numeric validation. Reject anything that isn't a finite, non-negative number.
    // Accepts integer or float; rejects strings, NaN, Infinity, undefined, null, negatives.
    const validateAmount = (v: unknown): number | null => {
      if (typeof v !== "number") return null;
      if (!Number.isFinite(v)) return null; // catches NaN and ±Infinity
      if (v < 0) return null;
      return v;
    };

    const cash  = validateAmount(body.cash);
    const check = validateAmount(body.check);
    const card  = validateAmount(body.card);

    if (cash === null || check === null || card === null) {
      return new Response(
        JSON.stringify({ error: "Invalid payment amounts" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Fetch order to verify ownership AND that it's currently at_pit.
    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("id, driver_id, driver_workflow_status")
      .eq("id", orderId)
      .maybeSingle();

    if (fetchErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (order.driver_id !== driverId) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Hard gate: only at_pit can record payment. Not before. Not after.
    if (order.driver_workflow_status !== "at_pit") {
      return new Response(
        JSON.stringify({ error: "Payment can only be recorded at the pit step" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const { data: updated, error: updateErr } = await supabase
      .from("orders")
      .update({
        driver_collected_cash:  cash,
        driver_collected_check: check,
        driver_collected_card:  card,
        driver_collected_at:    new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("driver_id", driverId)
      .select(
        "id, order_number, customer_name, customer_phone, delivery_address, delivery_window, delivery_date, quantity, price, payment_method, payment_status, notes, driver_workflow_status, acknowledged_at, at_pit_at, loaded_at, workflow_delivered_at, driver_collected_cash, driver_collected_check, driver_collected_card, driver_collected_at, pit_id, pit:pits(name)",
      )
      .maybeSingle();

    if (updateErr || !updated) {
      return new Response(JSON.stringify({ error: "Failed to record payment" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ order: updated }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
