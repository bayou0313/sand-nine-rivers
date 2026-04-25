// Path B Phase 3a — driver portal auth foundation
// Public endpoint (no JWT). Validates phone + bcrypted PIN. Issues 30-day session
// tokens. Mirrors the leads-auth structure: single entrypoint, action verb dispatch,
// service-role supabase client, generic error messages to prevent enumeration.
//
// Actions: login, logout, list_my_orders
// Internal helper: verify_session (not exposed as a public action)
//
// Security:
// - bcryptjs@2.4.3 cost 10 (matches existing 2FA backup-code pattern in leads-auth)
// - Session tokens: 32 random bytes, base64url (RFC 4648 §5) for return; SHA-256 hash stored
// - Generic "Invalid credentials" for both missing phone and wrong PIN
// - In-memory rate limit: 5 attempts per 60s per IP (best-effort; cold-start bypass
//   acknowledged for Phase 3a — DB-backed limiter deferred to a later phase)
// - Session tokens never logged anywhere

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
// Cold-start bypass is acknowledged. Best-effort only at this phase.
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const action = body?.action;
  const ip = getClientIp(req);

  // ── LOGIN ──
  if (action === "login") {
    if (!checkRate(ip)) {
      return new Response(
        JSON.stringify({ error: "Too many attempts. Try again in a minute." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ok = await bcrypt.compare(pin, driver.pin_hash);
    if (!ok) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── LIST MY ORDERS ──
  if (action === "list_my_orders") {
    const rawToken = typeof body.session_token === "string" ? body.session_token : "";
    const driverId = await verifySession(supabase, rawToken);
    if (!driverId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // today + tomorrow (driver's local day window — server uses UTC date strings;
    // delivery_date is a DATE column so timezone slop is bounded to ±1 day at most.
    // Phase 3b will revisit with an explicit operator timezone setting.)
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const { data: orders, error: oErr } = await supabase
      .from("orders")
      .select(
        "id, order_number, customer_name, customer_phone, delivery_address, delivery_window, delivery_date, quantity, price, payment_method, payment_status, notes",
      )
      .eq("driver_id", driverId)
      .gte("delivery_date", fmt(today))
      .lte("delivery_date", fmt(tomorrow))
      .order("delivery_date", { ascending: true })
      .order("delivery_window", { ascending: true });

    if (oErr) {
      return new Response(JSON.stringify({ error: "Failed to load orders" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ orders: orders || [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Unknown action" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
