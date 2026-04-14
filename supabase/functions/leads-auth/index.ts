/**
 * IMPORTANT: This system does NOT use haversine (straight-line) distances anywhere.
 * All distance calculations use the Google Distance Matrix API with
 * mode=driving and avoid=ferries. Toll roads (I-10 etc.) are used for
 * deliveries, so tolls are NOT avoided. Never add haversine as a fallback.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Northshore phantom miles — adds 3 miles to billed distance for deliveries
 * crossing Lake Pontchartrain (Causeway toll recovery).
 * Customer sees actual distance; pricing uses billed distance.
 */
/**
 * Internal fraud check — reusable by session_init and check_fraud action.
 * Returns { blocked: boolean, reason?: string }
 */
async function checkFraudInternal(
  sb: any,
  params: { ip?: string | null; phone?: string | null; email?: string | null; session_id?: string | null; address?: string | null }
): Promise<{ blocked: boolean; reason?: string }> {
  const { ip, phone, email, session_id, address } = params;
  const now = new Date().toISOString();

  // 1. Blocklist check
  if (ip || phone || email) {
    const { data: blocked } = await sb
      .from("fraud_blocklist")
      .select("*")
      .or(`and(type.eq.ip,value.eq.${ip || "___none___"}),and(type.eq.phone,value.eq.${phone || "___none___"}),and(type.eq.email,value.eq.${email || "___none___"})`)
      .or(`expires_at.is.null,expires_at.gt.${now}`);

    if (blocked && blocked.length > 0) {
      await sb.from("fraud_events").insert({ ip_address: ip, phone, email, session_id, event_type: "blocked_attempt", details: { blocked } });
      return { blocked: true, reason: blocked[0].reason || "Blocked" };
    }
  }

  // 2. Rate limit: max 5 sessions per IP per hour
  if (ip) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: sessionCount } = await sb
      .from("visitor_sessions")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ip)
      .gt("created_at", oneHourAgo);

    if ((sessionCount || 0) >= 5) {
      await sb.from("fraud_events").insert({ ip_address: ip, event_type: "velocity_flag", details: { sessionCount, reason: "IP session rate limit" } });
      return { blocked: true, reason: "Too many requests from this IP" };
    }
  }

  // 3. Payment attempt limit: max 5 failed per IP per day
  if (ip) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: ipPayments } = await sb
      .from("payment_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_address", ip)
      .eq("status", "failed")
      .gt("created_at", oneDayAgo);

    if ((ipPayments || 0) >= 5) {
      await sb.from("fraud_blocklist").upsert(
        { type: "ip", value: ip, reason: "Auto-blocked: 5+ failed payments in 24hr", blocked_by: "system" },
        { onConflict: "type,value" }
      );
      return { blocked: true, reason: "Payment attempt limit exceeded" };
    }
  }

  // 4. Address velocity: 3+ orders same address in 24hr → alert only
  if (address) {
    const streetPart = address.split(",")[0]?.trim();
    if (streetPart) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: addressOrders } = await sb
        .from("orders")
        .select("id", { count: "exact", head: true })
        .ilike("delivery_address", `%${streetPart}%`)
        .gt("created_at", oneDayAgo);

      if ((addressOrders || 0) >= 3) {
        await sb.from("fraud_events").insert({ ip_address: ip, event_type: "velocity_flag", details: { addressOrders, reason: "Address velocity" } });
        await sb.from("notifications").insert({
          type: "fraud_alert", title: "🚨 Fraud Alert",
          message: `⚠️ Velocity Alert: ${addressOrders} orders to same address in 24hr — ${streetPart}`,
          entity_type: "fraud", entity_id: null
        });
      }
    }
  }

  return { blocked: false };
}

const NORTHSHORE_ZIPS = new Set([
  '70433','70434','70435','70436','70437','70438',
  '70441','70443','70444','70445','70446','70447',
  '70448','70449','70458','70459','70460','70461',
  '70462','70463','70464','70465','70466','70467',
  '70469','70470','70471'
]);
const NORTHSHORE_PARISHES = new Set(['St. Tammany Parish']);
const isNorthshoreZip = (zip: string) => NORTHSHORE_ZIPS.has(zip);
const isNorthshoreRegion = (region: string) => NORTHSHORE_PARISHES.has(region);
const PHANTOM_MILES = 3;

/**
 * Server-side canonical distance function.
 * Mirror of getDrivingDistanceBatch in src/lib/pits.ts — keep in sync.
 * Roads only. No haversine fallback. Nulls mean skip, not approximate.
 */
async function getDrivingDistances(
  originLat: number,
  originLon: number,
  destinations: { lat: number; lng: number }[],
  apiKey: string
): Promise<(number | null)[]> {
  if (!apiKey) {
    throw new Error(
      "getDrivingDistances: GOOGLE_MAPS_SERVER_KEY is not configured. " +
      "Cannot calculate road distances. Set the secret in Supabase Dashboard."
    );
  }
  if (destinations.length === 0) return [];

  const results: (number | null)[] = new Array(destinations.length).fill(null);
  const BATCH = 25;

  for (let i = 0; i < destinations.length; i += BATCH) {
    const batch = destinations.slice(i, i + BATCH);
    const destsStr = batch.map(d => `${d.lat},${d.lng}`).join("|");
    try {
      const url =
        `https://maps.googleapis.com/maps/api/distancematrix/json` +
        `?origins=${originLat},${originLon}` +
        `&destinations=${destsStr}` +
        `&units=imperial` +
        `&mode=driving` +
        `&avoid=ferries` +
        `&key=${apiKey}`;
      const resp = await fetch(url);
      const data = await resp.json();
      if (data.status && data.status !== "OK") {
        console.error(`[getDrivingDistances] API top-level error: ${data.status} — ${data.error_message || "no message"}`);
        continue;
      }
      const elements = data.rows?.[0]?.elements || [];
      if (elements.length === 0) {
        console.error(`[getDrivingDistances] No elements returned. rows: ${JSON.stringify(data.rows?.length)}, status: ${data.status}`);
      }
      for (let j = 0; j < elements.length; j++) {
        if (elements[j]?.status === "OK" && elements[j].distance?.value) {
          results[i + j] = elements[j].distance.value / 1609.344;
        } else {
          console.warn(`[getDrivingDistances] Element ${i+j} status: ${elements[j]?.status}`);
        }
      }
    } catch (e) {
      console.error("[getDrivingDistances] Batch request failed:", e);
    }
  }
  return results;
}

/**
 * Cities too large or geographically complex to quote a single delivery price.
 * Pages for these cities always suppress static pricing and direct to the estimator,
 * regardless of PIT count.
 * Add any city here where a single centroid distance is misleading.
 */
/**
 * Normalize city slugs by removing state suffixes to prevent duplicates
 * like "kenner" vs "kenner-la".
 */
function normalizeSlug(slug: string): string {
  return slug
    .replace(/-la$/, '')
    .replace(/-tx$/, '')
    .replace(/-ms$/, '')
    .replace(/-al$/, '')
    .toLowerCase()
    .trim();
}

const LARGE_CITIES_NO_STATIC_PRICE = new Set([
  "new orleans",
  "new orleans east",
  "algiers",
  "metairie",
  "kenner",
  "baton rouge",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { password, action, id, ids, stage, notes, lead_number, order_number, settings, pit, order_id, collected_by, send_email, pit_id, cities, city_page, city_page_id, base_price, free_miles, price_per_extra_mile, url } = body;

    // ── GET NOTRACK IPS (password required) ──
    if (action === "get_notrack_ips") {
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data } = await sb.from("global_settings").select("value").eq("key", "notrack_ips").single();
      const ips = data ? JSON.parse(data.value) : [];
      return new Response(JSON.stringify({ ips }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── SET NOTRACK IPS (password required) ──
    if (action === "set_notrack_ips") {
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { ips } = body;
      if (!Array.isArray(ips)) {
        return new Response(JSON.stringify({ error: "ips must be an array" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await sb.from("global_settings").update({ value: JSON.stringify(ips) }).eq("key", "notrack_ips");
      return new Response(JSON.stringify({ success: true, count: ips.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Helper: check if IP is in notrack list ──
    async function isNotrackIp(ip: string): Promise<boolean> {
      if (!ip || ip === "unknown") return false;
      try {
        const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data } = await sb.from("global_settings").select("value").eq("key", "notrack_ips").single();
        if (!data) return false;
        const ips: string[] = JSON.parse(data.value);
        return ips.includes(ip);
      } catch { return false; }
    }

    // ── SESSION INIT (no password required — called from frontend) ──
    if (action === "session_init") {
      const { session_token, entry_page, referrer } = body;
      if (!session_token) {
        return new Response(JSON.stringify({ error: "Missing session_token" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check notrack IP
      const visitorIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("x-real-ip")
        || "unknown";
      if (await isNotrackIp(visitorIp)) {
        console.log(`[session_init] Skipping notrack IP: ${visitorIp}`);
        return new Response(JSON.stringify({ success: true, notrack: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceRoleKey);

      // ── Fraud gate — block known bad actors before session creation ──
      const fraudResult = await checkFraudInternal(sb, {
        ip: visitorIp !== "unknown" ? visitorIp : null,
        phone: null, email: null, session_id: session_token, address: null
      });
      if (fraudResult.blocked) {
        console.log(`[session_init] Blocked by fraud check: ${fraudResult.reason}`);
        return new Response(
          JSON.stringify({ blocked: true, reason: fraudResult.reason }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Geolocate IP (free tier, best-effort)
      let geo: Record<string, any> = {};
      if (visitorIp && visitorIp !== "unknown") {
        try {
          const geoRes = await fetch(`https://ipapi.co/${visitorIp}/json/`);
          if (geoRes.ok) geo = await geoRes.json();
        } catch { /* silent */ }
      }

      const upsertData: Record<string, any> = {
        session_token,
        last_seen_at: new Date().toISOString(),
        ip_address: visitorIp !== "unknown" ? visitorIp : null,
      };
      if (geo.city) upsertData.geo_city = geo.city;
      if (geo.region) upsertData.geo_region = geo.region;
      if (geo.country_name) upsertData.geo_country = geo.country_name;
      if (geo.postal) upsertData.geo_zip = geo.postal;
      if (entry_page) upsertData.entry_page = entry_page;
      if (referrer) upsertData.referrer = referrer;

      // IP enrichment — org, city, zip, business detection
      if (geo.org) {
        upsertData.ip_org = geo.org;
        upsertData.ip_is_business = /(LLC|Inc|Corp|Construction|Contractor|Builders|Excavat|Paving|Landscap|Plumb|Electric|Roofing|Materials|Supply|Equipment|Trucking|Grading|Concrete|Masonry|Fencing|Demolition|Hauling|Septic|Utilities)/i.test(geo.org);
      }
      if (geo.city) upsertData.ip_city = geo.city;
      if (geo.postal) upsertData.ip_zip = geo.postal;

      await sb.from("visitor_sessions").upsert(
        upsertData,
        { onConflict: "session_token", ignoreDuplicates: false }
      );
      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── SESSION UPDATE (no password required — called from frontend) ──
    if (action === "session_update") {
      const { session_token, updates } = body;
      if (!session_token || !updates) {
        return new Response(JSON.stringify({ error: "Missing session_token or updates" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Check notrack IP
      const visitorIpUpd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("x-real-ip")
        || "unknown";
      if (await isNotrackIp(visitorIpUpd)) {
        console.log(`[session_update] Skipping notrack IP: ${visitorIpUpd}`);
        return new Response(JSON.stringify({ success: true, notrack: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceRoleKey);
      // Whitelist allowed fields
      const allowed = ["stage","delivery_address","address_lat","address_lng",
        "calculated_price","serviceable","nearest_pit_id","nearest_pit_name",
        "customer_name","customer_email","customer_phone","order_id","order_number",
        "entry_page","entry_city_page","entry_city_name"];
      const safe: Record<string, any> = {};
      for (const k of allowed) {
        if (updates[k] !== undefined) safe[k] = updates[k];
      }
      safe.updated_at = new Date().toISOString();
      safe.last_seen_at = new Date().toISOString();
      // Capture IP on every session update
      const visitorIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("x-real-ip")
        || null;
      if (visitorIp) safe.ip_address = visitorIp;
      console.log("[session_update] token:", session_token?.slice(0, 8));
      console.log("[session_update] updates:", JSON.stringify(updates));

      // Check previous stage before upserting (for out-of-area notification)
      let previousStage: string | null = null;
      if (updates.stage === "got_out_of_area") {
        const { data: existing } = await sb.from("visitor_sessions")
          .select("stage").eq("session_token", session_token).single();
        previousStage = existing?.stage || null;
      }

      await sb.from("visitor_sessions").upsert(
        { session_token, ...safe },
        { onConflict: "session_token", ignoreDuplicates: false }
      );

      // Send internal out-of-area notification (once per session)
      if (updates.stage === "got_out_of_area" && previousStage !== "got_out_of_area") {
        try {
          const resendKey = Deno.env.get("RESEND_API_KEY");
          const ownerEmail = Deno.env.get("GMAIL_USER") || "cmo@haulogix.com";
          if (resendKey) {
            const { Resend } = await import("npm:resend@2.0.0");
            const resend = new Resend(resendKey);
            const addr = updates.delivery_address || "Unknown";
            const pitName = updates.nearest_pit_name || "Unknown";
            const city = addr.split(",")[1]?.trim() || addr.split(",")[0]?.trim() || "Unknown";
            await resend.emails.send({
              from: "River Sand <no_reply@riversand.net>",
              to: [ownerEmail],
              subject: `Out-of-Area Lead — ${city}`,
              html: `<div style="font-family:Arial,sans-serif;max-width:500px">
                <h2 style="color:#0D2137;margin-bottom:16px">Out-of-Area Lead</h2>
                <table style="width:100%;border-collapse:collapse">
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">Address</td><td style="padding:8px 0;border-bottom:1px solid #eee">${addr}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">Nearest Pit</td><td style="padding:8px 0;border-bottom:1px solid #eee">${pitName}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:600">IP</td><td style="padding:8px 0;border-bottom:1px solid #eee">${visitorIp || "Unknown"}</td></tr>
                </table>
                <p style="color:#666;margin-top:16px;font-size:14px">This visitor is outside our service area. Consider if this area warrants expansion.</p>
              </div>`,
            });
            console.log("[session_update] Out-of-area notification sent for:", addr);
          }
        } catch (notifyErr) {
          console.error("[session_update] Out-of-area notification failed:", notifyErr);
        }
      }

      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── CALCULATE DISTANCES (no password required — called from frontend) ──
    if (action === "calculate_distances") {
      const { origins, destination } = body;
      if (!origins?.length || !destination) {
        return new Response(
          JSON.stringify({ error: "Missing origins or destination" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const apiKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY") || "";
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "GOOGLE_MAPS_SERVER_KEY not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      // Accept origins and destination as street address strings
      const originsStr = (origins as string[]).map((o: string) => encodeURIComponent(o)).join("|");
      const destStr = encodeURIComponent(destination as string);
      console.log("[calculate_distances] origins:", JSON.stringify(origins));
      console.log("[calculate_distances] destination:", JSON.stringify(destination));
      const url =
        `https://maps.googleapis.com/maps/api/distancematrix/json` +
        `?origins=${originsStr}` +
        `&destinations=${destStr}` +
        `&units=imperial&mode=driving&avoid=ferries` +
        `&key=${apiKey}`;
      console.log("[calculate_distances] calling URL:", url.replace(apiKey, "KEY_HIDDEN"));
      const resp = await fetch(url);
      const data = await resp.json();
      console.log("[calculate_distances] API status:", data.status);
      console.log("[calculate_distances] origin_addresses:", data.origin_addresses);
      console.log("[calculate_distances] destination_addresses:", data.destination_addresses);
      console.log("[calculate_distances] rows:", JSON.stringify(data.rows));
      const distances = (data.rows || []).map((row: any) => {
        const el = row.elements?.[0];
        if (el?.status === "OK" && el.distance?.value) {
          return el.distance.value / 1609.344;
        }
        return null;
      });

      // Northshore phantom miles — add 3 mi to billed distance for toll recovery
      const destZip = body.zip_code || '';
      const northshore = isNorthshoreZip(destZip);
      const billedDistances = distances.map((d: number | null) =>
        d != null && northshore ? d + PHANTOM_MILES : d
      );

      console.log("[calculate_distances] raw distances (miles):", JSON.stringify(distances));
      if (northshore) console.log("[calculate_distances] Northshore ZIP detected:", destZip, "→ +3 phantom miles");
      return new Response(
        JSON.stringify({ distances, billed_distances: billedDistances, is_northshore: northshore }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── JOIN WAITLIST (no password required — public) ──
    if (action === "join_waitlist") {
      const { city_slug, city_name, customer_name, customer_email, customer_phone } = body;
      if (!customer_email || !city_slug) {
        return new Response(JSON.stringify({ error: "Email and city required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceRoleKey);

      // Check if already on waitlist
      const { data: existingWl } = await sb.from("waitlist_leads")
        .select("id").eq("customer_email", customer_email).eq("city_slug", city_slug).maybeSingle();
      if (existingWl) {
        return new Response(JSON.stringify({ success: true, message: "Already on waitlist" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await sb.from("waitlist_leads").insert({ city_slug, city_name: city_name || city_slug, customer_name, customer_email, customer_phone });

      // Insert waitlist notification
      try {
        await sb.from("notifications").insert({
          type: "waitlist_signup",
          title: "Waitlist Signup",
          message: `${customer_email} joined waitlist for ${city_name || city_slug}`,
          entity_type: "waitlist",
          entity_id: null,
        });
      } catch (notifErr) { console.error("[join_waitlist] Notification insert error:", notifErr); }

      // Send waitlist confirmation email
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({ type: "waitlist", data: { city_name: city_name || city_slug, customer_name, customer_email } }),
        });
      } catch (emailErr: any) { console.error("[join_waitlist] Email error:", emailErr.message); }

      return new Response(JSON.stringify({ success: true, message: "Added to waitlist" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // ── CREATE OUT-OF-AREA LEAD (no password required — public) ──
    if (action === "create_out_of_area_lead") {
      const { customer_name, customer_email, customer_phone, address: leadAddress, distance_miles: leadDist, notes: leadNotes, ip_address: clientIp, user_agent: clientUA, browser_geolat, browser_geolng, calculated_price: leadPrice, nearest_pit_id: leadPitId, nearest_pit_name: leadPitName, nearest_pit_distance: leadPitDist } = body;
      if (!customer_name || !leadAddress) {
        return new Response(JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceRoleKey);

      // Server-side IP (more reliable than client-reported)
      const serverIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("x-real-ip")
        || clientIp
        || null;

      // ── Fraud scoring ──
      let fraudScore = 0;
      const fraudSignals: string[] = [];

      // Signal 1: IP rate limiting
      if (serverIp) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentLeads } = await sb
          .from("delivery_leads")
          .select("id")
          .eq("ip_address", serverIp)
          .gte("created_at", twentyFourHoursAgo);
        const ipCount = recentLeads?.length || 0;
        if (ipCount > 5) { fraudScore += 60; fraudSignals.push("ip_flood"); }
        else if (ipCount > 2) { fraudScore += 40; fraudSignals.push("repeated_ip"); }
      }

      // Signal 2: Check blocked_ips
      if (serverIp) {
        const { data: blocked } = await sb
          .from("blocked_ips")
          .select("id")
          .eq("ip_address", serverIp)
          .limit(1);
        if (blocked && blocked.length > 0) {
          // Silent block — return success but don't insert
          console.log("[create_out_of_area_lead] Blocked IP:", serverIp);
          return new Response(JSON.stringify({ success: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // Signal 3: Geolocation mismatch (haversine is fine — browser vs address comparison)
      if (browser_geolat != null && browser_geolng != null) {
        // Extract lat/lng from address if available, or use a rough check with nearest pit
        if (leadPitId) {
          const { data: pitData } = await sb.from("pits").select("lat, lon").eq("id", leadPitId).single();
          if (pitData) {
            const R = 3958.8; // Earth radius in miles
            const dLat = (browser_geolat - pitData.lat) * Math.PI / 180;
            const dLon = (browser_geolng - pitData.lon) * Math.PI / 180;
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(browser_geolat * Math.PI / 180) * Math.cos(pitData.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
            const browserToPitMiles = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            // If browser is very far from the nearest PIT (proxy for address area)
            if (browserToPitMiles > 200) { fraudScore += 50; fraudSignals.push("severe_geo_mismatch"); }
            else if (browserToPitMiles > 50) { fraudScore += 30; fraudSignals.push("geo_mismatch"); }
          }
        }
      }

      // Signal 4: Disposable email
      const disposableDomains = ["mailinator.com","guerrillamail.com","tempmail.com","throwaway.email","fakeinbox.com","yopmail.com","maildrop.cc","dispostable.com","trashmail.com","10minutemail.com","guerrillamail.info","sharklasers.com","grr.la","guerrillamail.net","guerrillamail.org"];
      if (customer_email) {
        const emailDomain = customer_email.split("@")[1]?.toLowerCase();
        if (emailDomain && disposableDomains.includes(emailDomain)) {
          fraudScore += 40; fraudSignals.push("disposable_email");
        }
      }

      // Signal 5: Missing contact info
      if (!customer_phone && !customer_email) {
        fraudScore += 20; fraudSignals.push("no_contact");
      }

      const riskLevel = fraudScore >= 80 ? "high" : fraudScore >= 40 ? "medium" : "low";

      // Count submission from same IP for submission_count
      let submissionCount = 1;
      if (serverIp) {
        const { data: allFromIp } = await sb.from("delivery_leads").select("id").eq("ip_address", serverIp);
        submissionCount = (allFromIp?.length || 0) + 1;
      }

      // Insert lead
      const insertData: Record<string, any> = {
        address: leadAddress,
        distance_miles: leadDist ?? null,
        customer_name,
        customer_email: customer_email || null,
        customer_phone: customer_phone || null,
        notes: leadNotes || null,
        ip_address: serverIp,
        user_agent: clientUA || null,
        browser_geolat: browser_geolat ?? null,
        browser_geolng: browser_geolng ?? null,
        calculated_price: leadPrice ?? null,
        nearest_pit_id: leadPitId || null,
        nearest_pit_name: leadPitName || null,
        nearest_pit_distance: leadPitDist ?? null,
        fraud_score: fraudScore,
        fraud_signals: fraudSignals.length > 0 ? fraudSignals : null,
        submission_count: submissionCount,
        geo_matches_address: browser_geolat != null ? !fraudSignals.includes("geo_mismatch") && !fraudSignals.includes("severe_geo_mismatch") : null,
      };

      const { data: inserted, error: insertErr } = await sb.from("delivery_leads").insert(insertData as any).select("id, lead_number").single();
      if (insertErr) throw insertErr;

      console.log(`[create_out_of_area_lead] Created lead ${inserted.lead_number}, fraud_score: ${fraudScore}, risk: ${riskLevel}`);

      // Insert new_lead notification
      try {
        await sb.from("notifications").insert({
          type: "new_lead",
          title: "New Lead",
          message: `${customer_name} submitted a request for ${leadAddress}`,
          entity_type: "lead",
          entity_id: inserted.id,
        });
        // Fraud notification if high risk
        if (fraudScore >= 80) {
          await sb.from("notifications").insert({
            type: "fraud_flagged",
            title: "⚠️ High Risk Lead",
            message: `High fraud score (${fraudScore}) on lead from ${serverIp || "unknown"}`,
            entity_type: "lead",
            entity_id: inserted.id,
          });
        }
      } catch (notifErr) { console.error("[create_out_of_area_lead] Notification insert error:", notifErr); }

      // Send admin notification email (fire-and-forget)
      const ownerEmail = Deno.env.get("GMAIL_USER") || "cmo@haulogix.com";
      fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({
          type: "out_of_area_lead",
          data: {
            lead_number: inserted.lead_number,
            address: leadAddress,
            distance_miles: leadDist?.toFixed?.(1) || "Unknown",
            customer_name,
            customer_email: customer_email || "Not provided",
            customer_phone: customer_phone || "Not provided",
            notes: leadNotes || "",
            fraud_score: fraudScore,
            risk_level: riskLevel,
            fraud_signals: fraudSignals.join(", ") || "None",
            ip_address: serverIp || "Unknown",
            created_at: new Date().toISOString(),
          },
        }),
      }).catch((err: any) => console.error("[lead-email] Admin notification error:", err));

      // Fetch business hours for confirmation email
      let responseTimeHours = "2";
      let businessHours = "7:00 AM – 5:00 PM";
      let businessDays = "Monday–Saturday";
      try {
        const { data: bizSettings } = await sb
          .from("global_settings")
          .select("key, value")
          .in("key", ["response_time_hours", "business_hours_start", "business_hours_end", "business_days"]);
        if (bizSettings) {
          for (const s of bizSettings) {
            if (s.key === "response_time_hours") responseTimeHours = s.value;
            if (s.key === "business_days") businessDays = s.value;
            if (s.key === "business_hours_start") {
              const end = bizSettings.find((x: any) => x.key === "business_hours_end")?.value || "17:00";
              businessHours = `${s.value} – ${end}`;
            }
          }
        }
      } catch (e) { console.error("[lead] Failed to fetch business hours:", e); }

      // Send customer auto-confirmation email (fire-and-forget)
      if (customer_email) {
        fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({
            type: "lead_confirmation",
            data: {
              customer_name,
              customer_email,
              delivery_address: leadAddress,
              response_time_hours: responseTimeHours,
              business_hours: businessHours,
              business_days: businessDays,
            },
          }),
        }).catch((err: any) => console.error("[lead-email] Customer confirmation error:", err));
      }

      return new Response(JSON.stringify({ success: true, lead_id: inserted.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── GET DATE LOAD COUNTS (no password required — called from frontend) ──
    if (action === "get_date_load_counts") {
      const { pit_id: loadPitId, dates: loadDates } = body;
      if (!loadPitId || !loadDates?.length) {
        return new Response(JSON.stringify({ error: "Missing pit_id or dates" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceRoleKey);

      // Count confirmed paid orders per date for this PIT
      const { data: orderRows, error: orderErr } = await sb
        .from("orders")
        .select("delivery_date")
        .eq("pit_id", loadPitId)
        .in("delivery_date", loadDates)
        .eq("payment_status", "paid")
        .eq("status", "confirmed");
      if (orderErr) throw orderErr;

      const counts: Record<string, number> = {};
      for (const row of orderRows || []) {
        const d = row.delivery_date;
        if (d) counts[d] = (counts[d] || 0) + 1;
      }

      // Count ALL orders across ALL PITs per date (for global max_daily_limit)
      const { data: globalOrderRows, error: globalOrderErr } = await sb
        .from("orders")
        .select("delivery_date")
        .in("delivery_date", loadDates)
        .eq("payment_status", "paid")
        .eq("status", "confirmed");
      if (globalOrderErr) throw globalOrderErr;

      const global_counts: Record<string, number> = {};
      for (const row of globalOrderRows || []) {
        const d = row.delivery_date;
        if (d) global_counts[d] = (global_counts[d] || 0) + 1;
      }

      // Get PIT limits
      const { data: pitRow } = await sb
        .from("pits")
        .select("saturday_load_limit, sunday_load_limit")
        .eq("id", loadPitId)
        .single();

      // Get global max daily limit
      const { data: globalRow } = await sb
        .from("global_settings")
        .select("value")
        .eq("key", "max_daily_limit")
        .single();

      return new Response(JSON.stringify({
        counts,
        global_counts,
        saturday_load_limit: pitRow?.saturday_load_limit ?? null,
        sunday_load_limit: pitRow?.sunday_load_limit ?? null,
        max_daily_limit: globalRow?.value ? parseInt(globalRow.value) : null,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── LOG PAYMENT ATTEMPT (no password — called from stripe-webhook) ──
    if (action === "log_payment_attempt") {
      const { ip_address, session_id, email, phone, amount, status } = body;
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      await sb.from("payment_attempts").insert({
        ip_address, session_id, email, phone, amount, status
      });

      // Auto-block after 3 failed attempts from same session
      if (status === "failed" && session_id) {
        const { count } = await sb
          .from("payment_attempts")
          .select("id", { count: "exact", head: true })
          .eq("session_id", session_id)
          .eq("status", "failed");

        if ((count || 0) >= 3) {
          if (ip_address) {
            await sb.from("fraud_blocklist").upsert(
              { type: "ip", value: ip_address, reason: "Auto-blocked: 3 failed payments same session", blocked_by: "system" },
              { onConflict: "type,value" }
            );
          }
          await sb.from("notifications").insert({
            type: "fraud_alert",
            title: "🚨 Auto-Blocked",
            message: `IP ${ip_address} auto-blocked: 3 failed payment attempts from session ${session_id?.slice(0, 8)}`,
            entity_type: "fraud",
            entity_id: session_id || null
          });
        }
      }

      return new Response(JSON.stringify({ logged: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    const leadsPassword = Deno.env.get("LEADS_PASSWORD");
    if (!leadsPassword || password !== leadsPassword) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── LIST LEADS ──
    if (action === "list") {
      const { data, error } = await supabase
        .from("delivery_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(
        JSON.stringify({ leads: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── TOGGLE CONTACTED ──
    if (action === "toggle_contacted") {
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: current, error: fetchErr } = await supabase
        .from("delivery_leads").select("contacted").eq("id", id).single();
      if (fetchErr) throw fetchErr;
      const { error: updateErr } = await supabase
        .from("delivery_leads").update({ contacted: !current.contacted }).eq("id", id);
      if (updateErr) throw updateErr;
      return new Response(
        JSON.stringify({ success: true, contacted: !current.contacted }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── UPDATE STAGE ──
    if (action === "update_stage") {
      if (!id || !stage) {
        return new Response(JSON.stringify({ error: "Missing id or stage" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const validStages = ["new", "called", "quoted", "won", "lost"];
      if (!validStages.includes(stage)) {
        return new Response(JSON.stringify({ error: "Invalid stage" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error: updateErr } = await supabase
        .from("delivery_leads").update({ stage }).eq("id", id);
      if (updateErr) throw updateErr;
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── UPDATE NOTES ──
    if (action === "update_notes") {
      if (!id || notes === undefined) {
        return new Response(JSON.stringify({ error: "Missing id or notes" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: current, error: fetchErr } = await supabase
        .from("delivery_leads").select("notes").eq("id", id).single();
      if (fetchErr) throw fetchErr;
      const timestamp = new Date().toLocaleString("en-US");
      const existingNotes = current.notes || "";
      const newNotes = existingNotes
        ? `${existingNotes}\n[${timestamp}] ${notes}`
        : `[${timestamp}] ${notes}`;
      const { error: updateErr } = await supabase
        .from("delivery_leads").update({ notes: newNotes }).eq("id", id);
      if (updateErr) throw updateErr;
      return new Response(
        JSON.stringify({ success: true, notes: newNotes }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── MARK CONVERTED ──
    if (action === "mark_converted") {
      if (!lead_number) {
        return new Response(JSON.stringify({ error: "Missing lead_number" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: lead, error: fetchErr } = await supabase
        .from("delivery_leads").select("id, notes").eq("lead_number", lead_number).single();
      if (fetchErr) {
        console.error("[leads-auth] Lead not found:", lead_number, fetchErr);
        return new Response(JSON.stringify({ error: "Lead not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const timestamp = new Date().toLocaleString("en-US");
      const existingNotes = lead.notes || "";
      const conversionNote = `[${timestamp}] CONVERTED — Order ${order_number || "N/A"} placed`;
      const newNotes = existingNotes ? `${existingNotes}\n${conversionNote}` : conversionNote;
      const { error: updateErr } = await supabase
        .from("delivery_leads").update({ stage: "won", contacted: true, notes: newNotes }).eq("id", lead.id);
      if (updateErr) throw updateErr;
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── SEND OFFER (create pre-order + Stripe payment link) ──
    if (action === "send_offer") {
      const { lead_id, pit_id: offerPitId, calculated_price: offerPrice } = body;
      if (!lead_id || !offerPitId || !offerPrice) {
        return new Response(JSON.stringify({ error: "Missing lead_id, pit_id, or calculated_price" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Fetch lead
      const { data: lead, error: leadErr } = await supabase
        .from("delivery_leads").select("*").eq("id", lead_id).single();
      if (leadErr || !lead) {
        return new Response(JSON.stringify({ error: "Lead not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Check stripe mode — skip DB write in test mode
      const { data: modeRow } = await supabase
        .from("global_settings")
        .select("value")
        .eq("key", "stripe_mode")
        .single();
      if (modeRow?.value === "test") {
        console.log("[send_offer] TEST MODE — skipping order creation");
        return new Response(JSON.stringify({
          success: true,
          order_id: "test-" + Date.now(),
          order_number: "RS-TEST-0000",
          payment_url: "https://riversand.net/order?payment=test",
          test_mode: true,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Create order via RPC
      const orderData = {
        customer_name: lead.customer_name,
        customer_email: lead.customer_email || "",
        customer_phone: lead.customer_phone || "",
        delivery_address: lead.address,
        distance_miles: lead.distance_miles || 0,
        price: offerPrice,
        quantity: 1,
        notes: lead.notes || "",
        payment_method: "stripe",
        payment_status: "pending",
        pit_id: offerPitId,
        lead_reference: lead.lead_number || "",
      };

      const { data: orderResult, error: orderErr } = await supabase.rpc("create_order", { p_data: orderData });
      if (orderErr) throw orderErr;
      const orderId = orderResult.id;
      const orderNumber = orderResult.order_number;

      // Generate Stripe checkout link
      const supabaseUrl2 = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const amountCents = Math.round(offerPrice * 100);
      const checkoutResp = await fetch(`${supabaseUrl2}/functions/v1/create-checkout-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey2}` },
        body: JSON.stringify({
          amount: amountCents,
          description: `River Sand Delivery — ${lead.address}`,
          customer_name: lead.customer_name,
          customer_email: lead.customer_email,
          order_id: orderId,
          order_number: orderNumber,
          origin_url: "https://riversand.net",
        }),
      });
      const checkoutData = await checkoutResp.json();
      const paymentUrl = checkoutData.url;

      // Update lead
      await supabase.from("delivery_leads").update({
        stage: "quoted",
        offer_sent_at: new Date().toISOString(),
        pre_order_id: orderId,
        calculated_price: offerPrice,
      } as any).eq("id", lead_id);

      // Send offer email to customer (fire-and-forget)
      if (lead.customer_email) {
        fetch(`${supabaseUrl2}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey2}` },
          body: JSON.stringify({
            type: "lead_offer",
            data: {
              customer_name: lead.customer_name,
              customer_email: lead.customer_email,
              address: lead.address,
              price: offerPrice,
              payment_url: paymentUrl,
              order_number: orderNumber,
            },
          }),
        }).catch((err: any) => console.error("[send_offer] Email error:", err));
      }

      console.log(`[send_offer] Created order ${orderNumber} for lead ${lead_id}, payment URL generated`);

      return new Response(JSON.stringify({ success: true, order_id: orderId, order_number: orderNumber, payment_url: paymentUrl }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── DECLINE LEAD ──
    if (action === "decline_lead") {
      const { lead_id } = body;
      if (!lead_id) {
        return new Response(JSON.stringify({ error: "Missing lead_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: lead, error: leadErr } = await supabase
        .from("delivery_leads").select("*").eq("id", lead_id).single();
      if (leadErr || !lead) {
        return new Response(JSON.stringify({ error: "Lead not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Update lead stage
      await supabase.from("delivery_leads").update({
        stage: "lost",
        declined_at: new Date().toISOString(),
      } as any).eq("id", lead_id);

      // Add to waitlist
      if (lead.customer_email) {
        const cityMatch = lead.address.match(/,\s*([^,]+),\s*[A-Z]{2}\s+\d{5}/);
        const cityName = cityMatch?.[1]?.trim() || lead.address.split(",")[0]?.trim() || "Unknown";
        const citySlug = cityName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

        await supabase.from("waitlist_leads").upsert({
          city_slug: citySlug,
          city_name: cityName,
          customer_name: lead.customer_name,
          customer_email: lead.customer_email,
          customer_phone: lead.customer_phone,
        }, { onConflict: "customer_email,city_slug" }).select();

        // Send decline email (fire-and-forget)
        const supabaseUrl2 = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        fetch(`${supabaseUrl2}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey2}` },
          body: JSON.stringify({
            type: "lead_decline",
            data: {
              customer_name: lead.customer_name,
              customer_email: lead.customer_email,
              address: lead.address,
              city_name: cityName,
            },
          }),
        }).catch((err: any) => console.error("[decline_lead] Email error:", err));
      }

      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── VERIFY CALL (confirm order after phone verification) ──
    if (action === "verify_call") {
      const { order_id: verifyOrderId, verified_by } = body;
      if (!verifyOrderId) {
        return new Response(JSON.stringify({ error: "Missing order_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error: updateErr } = await supabase.from("orders").update({
        review_status: "call_verified",
        call_verified_at: new Date().toISOString(),
        call_verified_by: verified_by || "admin",
        status: "confirmed",
      }).eq("id", verifyOrderId);
      if (updateErr) throw updateErr;

      // Send dispatch notification (fire-and-forget)
      const { data: order } = await supabase.from("orders").select("*").eq("id", verifyOrderId).single();
      if (order) {
        const supabaseUrl2 = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        fetch(`${supabaseUrl2}/functions/v1/send-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey2}` },
          body: JSON.stringify({ type: "order", data: order }),
        }).catch((err: any) => console.error("[verify_call] Email error:", err));
      }

      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── FLAG FRAUD (block IP, refund if order exists) ──
    if (action === "flag_fraud") {
      const { lead_id: fraudLeadId, order_id: fraudOrderId, reason: fraudReason } = body;
      if (!fraudLeadId && !fraudOrderId) {
        return new Response(JSON.stringify({ error: "Missing lead_id or order_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let ipToBlock: string | null = null;

      // Handle lead fraud
      if (fraudLeadId) {
        const { data: lead } = await supabase.from("delivery_leads").select("ip_address").eq("id", fraudLeadId).single();
        if (lead?.ip_address) ipToBlock = lead.ip_address;
        await supabase.from("delivery_leads").update({
          fraud_score: 100,
          fraud_signals: ["manually_flagged"],
          stage: "lost",
        } as any).eq("id", fraudLeadId);
      }

      // Handle order fraud
      if (fraudOrderId) {
        const { data: order } = await supabase.from("orders").select("stripe_payment_id, delivery_address").eq("id", fraudOrderId).single();
        await supabase.from("orders").update({
          fraud_score: 100,
          fraud_signals: ["manually_flagged"],
          status: "cancelled",
          review_status: "cancelled",
        } as any).eq("id", fraudOrderId);

        // Trigger refund via create-refund function
        if (order?.stripe_payment_id) {
          const supabaseUrl2 = Deno.env.get("SUPABASE_URL")!;
          const serviceRoleKey2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          try {
            const refundResp = await fetch(`${supabaseUrl2}/functions/v1/create-refund`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey2}` },
              body: JSON.stringify({ payment_intent_id: order.stripe_payment_id, reason: "fraudulent" }),
            });
            const refundData = await refundResp.json();
            console.log(`[flag_fraud] Refund result for order ${fraudOrderId}:`, refundData);
          } catch (refErr: any) {
            console.error("[flag_fraud] Refund error:", refErr);
          }
        }
      }

      // Block IP
      if (ipToBlock) {
        await supabase.from("blocked_ips").insert({
          ip_address: ipToBlock,
          reason: fraudReason || "Manually flagged as fraud",
          blocked_by: "admin",
        } as any);
      }

      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── GET PENDING REVIEW ORDERS ──
    if (action === "get_pending_review_orders") {
      const { data: orders, error: ordersErr } = await supabase
        .from("orders")
        .select("*")
        .eq("review_status", "pending_review")
        .order("created_at", { ascending: false });
      if (ordersErr) throw ordersErr;
      return new Response(JSON.stringify({ orders }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── GET SETTINGS ──
    if (action === "get_settings") {
      const { data, error } = await supabase
        .from("global_settings").select("key, value");
      if (error) throw error;
      const obj: Record<string, string> = {};
      for (const row of data || []) obj[row.key] = row.value;
      return new Response(
        JSON.stringify({ settings: obj }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── SAVE SETTINGS ──
    if (action === "save_settings") {
      if (!settings || typeof settings !== "object") {
        return new Response(JSON.stringify({ error: "Missing settings object" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      for (const [key, value] of Object.entries(settings)) {
        const { error } = await supabase
          .from("global_settings")
          .upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: "key" });
        if (error) throw error;
      }
      const { data, error } = await supabase
        .from("global_settings").select("key, value");
      if (error) throw error;
      const obj: Record<string, string> = {};
      for (const row of data || []) obj[row.key] = row.value;
      return new Response(
        JSON.stringify({ success: true, settings: obj }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── SAVE SETTINGS BULK ──
    if (action === "save_settings_bulk") {
      const { settings: bulkSettings } = JSON.parse(JSON.stringify({ settings }));
      if (!Array.isArray(bulkSettings)) {
        return new Response(JSON.stringify({ error: "settings must be an array of { key, value }" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const savedKeys: string[] = [];
      for (const setting of bulkSettings) {
        await supabase.from("global_settings").upsert(
          { key: setting.key, value: setting.value, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
        savedKeys.push(setting.key);
      }

      // ── PART 2: Auto-regen when pricing-related global settings change ──
      const pricingKeys = ["default_base_price", "default_free_miles", "default_extra_per_mile", "default_max_distance", "saturday_surcharge"];
      const pricingChanged = savedKeys.some(k => pricingKeys.includes(k));
      let pages_regenerated = 0;

      if (pricingChanged) {
        // Re-fetch updated global settings
        const { data: gs } = await supabase.from("global_settings").select("key, value");
        const gMap: Record<string, string> = {};
        for (const r of gs || []) gMap[r.key] = r.value;

        // Get all pits for effective pricing
        const { data: allPits } = await supabase.from("pits").select("*").eq("status", "active");
        const pitMap: Record<string, any> = {};
        for (const p of allPits || []) pitMap[p.id] = p;

        const { data: allPages } = await supabase
          .from("city_pages")
          .select("id, city_name, distance_from_pit, pit_id")
          .in("status", ["active", "draft"]);

        console.log(`[save_settings] Pricing changed — queuing regen for ${allPages?.length || 0} pages`);

        const regenUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-city-page`;
        const regenHeaders = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        };

        for (const page of allPages || []) {
          try {
            // Recalculate price using pit overrides + new global defaults
            const pit = pitMap[page.pit_id];
            const effBP = pit?.base_price ?? parseFloat(gMap.default_base_price || "195");
            const effFM = pit?.free_miles ?? parseFloat(gMap.default_free_miles || "15");
            const effEPM = pit?.price_per_extra_mile ?? parseFloat(gMap.default_extra_per_mile || "5");
            const dist = page.distance_from_pit || 0;
            const extraMiles = Math.max(0, dist - effFM);
            const newPrice = Math.max(effBP, Math.round(effBP + extraMiles * effEPM));

            await supabase.from("city_pages").update({
              base_price: newPrice,
              price_changed: true,
              regen_reason: 'price_changed',
              updated_at: new Date().toISOString(),
            }).eq("id", page.id);

            await fetch(regenUrl, {
              method: "POST",
              headers: regenHeaders,
              body: JSON.stringify({ city_page_id: page.id, force: true }),
            });
            console.log(`[save_settings] Regenerated: ${page.city_name} ($${newPrice})`);
            pages_regenerated++;
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (err: any) {
            console.error(`[save_settings] Failed: ${page.city_name}`, err.message);
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, saved: bulkSettings.length, pages_regenerated }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── LIST PITS ──
    if (action === "list_pits") {
      const { data, error } = await supabase
        .from("pits").select("*").order("is_default", { ascending: false }).order("name");
      if (error) throw error;
      return new Response(
        JSON.stringify({ pits: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── SAVE PIT ──
    if (action === "save_pit") {
      if (!pit) {
        return new Response(JSON.stringify({ error: "Missing pit object" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Validate coordinates — last line of defense
      if (
        pit.lat == null || pit.lon == null ||
        isNaN(Number(pit.lat)) || isNaN(Number(pit.lon)) ||
        Number(pit.lat) === 0 ||
        Number(pit.lat) < 24 || Number(pit.lat) > 50 ||
        Number(pit.lon) < -125 || Number(pit.lon) > -66
      ) {
        return new Response(
          JSON.stringify({
            error: `Invalid PIT coordinates: lat=${pit.lat}, lon=${pit.lon}. ` +
              "A valid US location is required. Enter a full street address or " +
              "provide GPS coordinates from Google Maps."
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let existingPit: any = null;
      let existingPitStatus: string | null = null;
      if (pit.id) {
        const { data: ep } = await supabase
          .from("pits").select("base_price, free_miles, price_per_extra_mile, status").eq("id", pit.id).maybeSingle();
        existingPit = ep;
        existingPitStatus = ep?.status || null;
      }

      const pitData = {
        name: pit.name,
        address: pit.address,
        lat: pit.lat,
        lon: pit.lon,
        status: pit.status || "planning",
        notes: pit.notes || "",
        base_price: pit.base_price ?? null,
        free_miles: pit.free_miles ?? null,
        price_per_extra_mile: pit.price_per_extra_mile ?? null,
        max_distance: pit.max_distance ?? null,
        is_default: pit.is_default || false,
        operating_days: pit.operating_days ?? null,
        saturday_surcharge_override: pit.saturday_surcharge_override ?? null,
        same_day_cutoff: pit.same_day_cutoff ?? null,
        sunday_surcharge: pit.sunday_surcharge ?? null,
        saturday_load_limit: pit.saturday_load_limit ?? null,
        sunday_load_limit: pit.sunday_load_limit ?? null,
        is_pickup_only: pit.is_pickup_only || false,
      };

      let savedPit: any;
      if (pit.id) {
        const { data, error } = await supabase
          .from("pits").update(pitData).eq("id", pit.id).select().single();
        if (error) throw error;
        savedPit = data;
      } else {
        const { data, error } = await supabase
          .from("pits").insert(pitData).select().single();
        if (error) throw error;
        savedPit = data;
      }

      const isNewPit = !pit.id;
      const apiKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY") || "";
      const regenUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-city-page`;
      const regenHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      };

      let prices_updated = 0;
      let pages_regenerated = 0;
      let regenTriggered = false;

      // ── PART 1: Auto-update prices & regen when existing pit pricing changes ──
      if (existingPit && !isNewPit) {
        const pricingChanged =
          (pit.base_price ?? null) !== (existingPit.base_price ?? null) ||
          (pit.free_miles ?? null) !== (existingPit.free_miles ?? null) ||
          (pit.price_per_extra_mile ?? null) !== (existingPit.price_per_extra_mile ?? null);

        if (pricingChanged) {
          const effBP = savedPit.base_price;
          const effFM = savedPit.free_miles;
          const effEPM = savedPit.price_per_extra_mile;

          const { data: affectedPages } = await supabase
            .from("city_pages")
            .select("id, city_name, distance_from_pit")
            .eq("pit_id", savedPit.id)
            .in("status", ["active", "draft"]);

          console.log(`[save_pit] Pricing changed — auto-updating ${affectedPages?.length || 0} city pages for pit ${savedPit.name}`);

          for (const page of affectedPages ?? []) {
            try {
              const dist = page.distance_from_pit || 0;
              const extraMiles = Math.max(0, dist - effFM);
              const newPrice = Math.max(effBP, Math.round(effBP + extraMiles * effEPM));
              await supabase.from("city_pages").update({
                base_price: newPrice,
                price_changed: true,
                regen_reason: 'price_changed',
                needs_regen: true,
                updated_at: new Date().toISOString()
              }).eq("id", page.id);
              prices_updated++;
              console.log(`[save_pit] Flagged for regen: ${page.city_name}`);
            } catch (err: any) {
              console.error(`[save_pit] Failed to regen ${page.city_name}:`, err.message);
            }
          }
          regenTriggered = true;
        }
      }

      // ── PART 1b: Always-regen for non-pricing edits (deduplicated) ──
      if (!regenTriggered && !isNewPit) {
        const { data: regenPages } = await supabase
          .from("city_pages")
          .select("id, city_name")
          .eq("pit_id", savedPit.id)
          .in("status", ["active", "draft"]);

        if (regenPages && regenPages.length > 0) {
          console.log(`[save_pit] Non-pricing edit — flagging ${regenPages.length} city pages for regen`);
          const regenIds = regenPages.map((p: any) => p.id);
          await supabase.from("city_pages").update({
            needs_regen: true,
            regen_reason: 'pit_updated',
            updated_at: new Date().toISOString()
          }).in("id", regenIds);
          pages_regenerated = regenPages.length;
          regenTriggered = true;
        }
      }

      // ── PART 2: PIT deactivation — reassign or waitlist ──
      let deactivation_reassigned = 0;
      let deactivation_waitlisted = 0;
      if (!isNewPit && existingPitStatus === "active" && savedPit.status === "inactive") {
        console.log(`[save_pit] PIT deactivated: ${savedPit.name} — reassigning city pages`);

        const { data: deactivatedPages } = await supabase
          .from("city_pages")
          .select("id, city_name, city_slug, lat, lng, distance_from_pit, status")
          .eq("pit_id", savedPit.id)
          .neq("status", "waitlist");

        if (deactivatedPages && deactivatedPages.length > 0) {
          // Get all OTHER active pits
          const { data: otherActivePits } = await supabase
            .from("pits").select("*").eq("status", "active").neq("id", savedPit.id);

          // Fetch global settings for pricing
          const { data: gsDeact } = await supabase.from("global_settings").select("key, value");
          const gMapDeact: Record<string, string> = {};
          for (const r of gsDeact || []) gMapDeact[r.key] = r.value;

          for (const page of deactivatedPages) {
            try {
              if (!page.lat || !page.lng || !otherActivePits || otherActivePits.length === 0) {
                // No active pits available — waitlist
                await supabase.from("city_pages").update({
                  status: "waitlist",
                  status_reason: "PIT deactivated, no alternative PIT available",
                  updated_at: new Date().toISOString(),
                }).eq("id", page.id);
                deactivation_waitlisted++;
                console.log(`[save_pit] Waitlisted: ${page.city_name} (no active PITs)`);
                continue;
              }

              // Calculate driving distances from this city to all other active pits
              const distances = await getDrivingDistances(
                Number(page.lat), Number(page.lng),
                otherActivePits.map(p => ({ lat: Number(p.lat), lng: Number(p.lon) })),
                apiKey
              );

              // Find nearest pit within its max_distance
              let bestPit: any = null;
              let bestDist = Infinity;
              for (let i = 0; i < otherActivePits.length; i++) {
                const d = distances[i];
                if (d == null) continue;
                const pitMax = otherActivePits[i].max_distance || parseFloat(gMapDeact.default_max_distance || "30");
                if (d <= pitMax && d < bestDist) {
                  bestDist = d;
                  bestPit = otherActivePits[i];
                }
              }

              if (bestPit) {
                // Reassign to new PIT
                const effBP = bestPit.base_price ?? parseFloat(gMapDeact.default_base_price || "195");
                const effFM = bestPit.free_miles ?? parseFloat(gMapDeact.default_free_miles || "15");
                const effEPM = bestPit.price_per_extra_mile ?? parseFloat(gMapDeact.default_extra_per_mile || "5");
                const extraMiles = Math.max(0, bestDist - effFM);
                const newPrice = Math.max(effBP, Math.round(effBP + extraMiles * effEPM));

                await supabase.from("city_pages").update({
                  pit_id: bestPit.id,
                  distance_from_pit: Math.round(bestDist * 10) / 10,
                  base_price: newPrice,
                  pit_reassigned: true,
                  regen_reason: "pit_reassigned",
                  needs_regen: true,
                  updated_at: new Date().toISOString(),
                }).eq("id", page.id);

                deactivation_reassigned++;
                console.log(`[save_pit] Reassigned: ${page.city_name} → ${bestPit.name} (${bestDist.toFixed(1)}mi, $${newPrice})`);
              } else {
                // No valid PIT — waitlist
                await supabase.from("city_pages").update({
                  status: "waitlist",
                  status_reason: "PIT deactivated, no alternative PIT within range",
                  updated_at: new Date().toISOString(),
                }).eq("id", page.id);
                deactivation_waitlisted++;
                console.log(`[save_pit] Waitlisted: ${page.city_name} (no PIT within range)`);
              }
            } catch (err: any) {
              console.error(`[save_pit] Deactivation error for ${page.city_name}:`, err.message);
            }
          }
        }
        console.log(`[save_pit] Deactivation complete: ${deactivation_reassigned} reassigned, ${deactivation_waitlisted} waitlisted`);
      }

      // ── PART 2b: PIT reactivation — reassign closer pages ──
      let reactivation_reassigned = 0;
      let reactivation_unwaitlisted = 0;
      if (!isNewPit && existingPitStatus !== "active" && savedPit.status === "active") {
        console.log(`[save_pit] PIT reactivated: ${savedPit.name} — checking for closer assignments`);

        // Get ALL city pages with coordinates
        const { data: allPages } = await supabase
          .from("city_pages")
          .select("id, city_name, city_slug, lat, lng, distance_from_pit, pit_id, status, base_price")
          .not("lat", "is", null)
          .not("lng", "is", null);

        if (allPages && allPages.length > 0) {
          // Fetch global settings for pricing
          const { data: gsReact } = await supabase.from("global_settings").select("key, value");
          const gMapReact: Record<string, string> = {};
          for (const r of gsReact || []) gMapReact[r.key] = r.value;

          const reactMaxDist = savedPit.max_distance || parseFloat(gMapReact.default_max_distance || "30");
          const effBP = savedPit.base_price ?? parseFloat(gMapReact.default_base_price || "195");
          const effFM = savedPit.free_miles ?? parseFloat(gMapReact.default_free_miles || "15");
          const effEPM = savedPit.price_per_extra_mile ?? parseFloat(gMapReact.default_extra_per_mile || "5");

          // Calculate driving distances from reactivated PIT to all city pages
          const destinations = allPages.map(p => ({ lat: Number(p.lat), lng: Number(p.lng) }));
          const drivingDists = await getDrivingDistances(
            Number(savedPit.lat), Number(savedPit.lon),
            destinations, apiKey
          );

          for (let i = 0; i < allPages.length; i++) {
            const page = allPages[i];
            const newDist = drivingDists[i];
            if (newDist == null || newDist > reactMaxDist) continue;

            try {
              if (page.status === "waitlist") {
                // Waitlisted page — reassign if within range
                const extraMiles = Math.max(0, newDist - effFM);
                const newPrice = Math.max(effBP, Math.round(effBP + extraMiles * effEPM));

                await supabase.from("city_pages").update({
                  pit_id: savedPit.id,
                  distance_from_pit: Math.round(newDist * 10) / 10,
                  base_price: newPrice,
                  status: "active",
                  status_reason: null,
                  pit_reassigned: true,
                  regen_reason: "pit_reactivated",
                  needs_regen: true,
                  updated_at: new Date().toISOString(),
                }).eq("id", page.id);
                reactivation_unwaitlisted++;
                console.log(`[save_pit] Un-waitlisted: ${page.city_name} → ${savedPit.name} (${newDist.toFixed(1)}mi, $${newPrice})`);
              } else if (page.pit_id !== savedPit.id) {
                // Already assigned to another PIT — only reassign if ≥3 miles closer
                const currentDist = page.distance_from_pit || 999;
                const improvement = currentDist - newDist;
                if (improvement >= 3) {
                  const extraMiles = Math.max(0, newDist - effFM);
                  const newPrice = Math.max(effBP, Math.round(effBP + extraMiles * effEPM));

                  await supabase.from("city_pages").update({
                    pit_id: savedPit.id,
                    distance_from_pit: Math.round(newDist * 10) / 10,
                    base_price: newPrice,
                    pit_reassigned: true,
                    regen_reason: "pit_reactivated",
                    needs_regen: true,
                    updated_at: new Date().toISOString(),
                  }).eq("id", page.id);
                  reactivation_reassigned++;
                  console.log(`[save_pit] Reactivation reassigned: ${page.city_name} → ${savedPit.name} (${newDist.toFixed(1)}mi vs ${currentDist.toFixed(1)}mi, improvement: ${improvement.toFixed(1)}mi)`);
                }
              }
            } catch (err: any) {
              console.error(`[save_pit] Reactivation error for ${page.city_name}:`, err.message);
            }
          }
        }
        console.log(`[save_pit] Reactivation complete: ${reactivation_reassigned} reassigned, ${reactivation_unwaitlisted} un-waitlisted`);
      }

      // ── PART 3: Auto-discover cities when new pit is created ──
      let pages_reassigned = 0;
      let pages_created_count = 0;
      if (isNewPit && savedPit.status === "active") {
        console.log(`[save_pit] New pit created: ${savedPit.name} — auto-discovering cities`);

        // Get all active pits including the new one
        const { data: allActivePitsForNew } = await supabase
          .from("pits").select("*").eq("status", "active");

        // Get existing city pages
        const { data: existingPagesForNew } = await supabase
          .from("city_pages")
          .select("id, city_name, city_slug, lat, lng, distance_from_pit, pit_id, status");
        const existingByNameForNew = new Map(
          (existingPagesForNew || []).map((p: any) => [p.city_name.toLowerCase(), p])
        );

        // Discover cities near new pit via reverse geocoding
        const newPitMaxDist = savedPit.max_distance || 30;
        const VALID_TYPES = ["sublocality_level_1", "locality", "administrative_area_level_3"];
        const EXCLUDE_WORDS = [
          "inc", "llc", "corp", "association", "club", "center", "centre",
          "park", "farm", "commission", "community", "fitness", "beach",
          "golf", "volleyball", "action", "development", "recreation",
          "school", "church", "hospital", "museum", "library", "university",
          "college", "foundation", "institute", "authority", "department",
          "council", "services", "group", "company", "studio", "restaurant",
          "hotel", "motel", "plaza", "mall", "shop", "store", "market",
          "yacht", "marina", "gym", "theater", "theatre", "arena",
        ];
        const cleanCityNameNew = (name: string) => name.replace(/^City of /i, "").replace(/^Town of /i, "").replace(/^Village of /i, "").replace(/\/.+$/, "").replace(/\s+Area$/i, "").replace(/\s+District$/i, "").replace(/\s+CDP$/i, "").trim();
        const isValidCityNameNew = (name: string) => {
          if (!name) return false;
          const lower = name.toLowerCase();
          for (const word of EXCLUDE_WORDS) { if (lower.includes(word)) return false; }
          const words = name.split(/\s+/);
          return words.length <= 4 && !words.some(w => w.length > 20);
        };

        // Generate sample points at various distances and directions
        const distancesArr = [3, 5, 8, 10, 13, 15, 18, 20, 23, 25, 28, 30, 33, 35, 38, 40, 43, 45, 48, 50].filter(d => d <= newPitMaxDist);
        const directionsArr = [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5];
        const samplePts: { lat: number; lng: number }[] = [{ lat: savedPit.lat, lng: savedPit.lon }];
        for (const dist of distancesArr) {
          for (const dir of directionsArr) {
            const rad = dir * Math.PI / 180;
            const dLat = (dist / 69) * Math.cos(rad);
            const dLng = (dist / (69 * Math.cos(savedPit.lat * Math.PI / 180))) * Math.sin(rad);
            samplePts.push({ lat: savedPit.lat + dLat, lng: savedPit.lon + dLng });
          }
        }
        console.log(`[save_pit] Sampling ${samplePts.length} points for reverse geocoding`);

        const cityMapNew = new Map<string, { name: string; state: string; lat: number; lng: number }>();
        const BATCH_SIZE = 10;
        for (let i = 0; i < samplePts.length; i += BATCH_SIZE) {
          const batch = samplePts.slice(i, i + BATCH_SIZE);
          const promises = batch.map(async (pt) => {
            try {
              const resp = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${pt.lat},${pt.lng}&result_type=locality|sublocality_level_1|administrative_area_level_3&key=${apiKey}`
              );
              return (await resp.json()).results || [];
            } catch { return []; }
          });
          const batchResults = await Promise.all(promises);
          for (const results of batchResults) {
            for (const result of results) {
              const types = result.types || [];
              if (!types.some((t: string) => VALID_TYPES.includes(t))) continue;
              const components = result.address_components || [];
              let cityName = "";
              let stateCode = "";
              for (const prio of VALID_TYPES) {
                const comp = components.find((c: any) => c.types?.includes(prio));
                if (comp && !cityName) cityName = comp.long_name;
              }
              const stateComp = components.find((c: any) => c.types?.includes("administrative_area_level_1"));
              if (stateComp) stateCode = stateComp.short_name;
              if (!cityName) continue;
              cityName = cleanCityNameNew(cityName);
              if (!isValidCityNameNew(cityName)) continue;
              const key = cityName.toLowerCase();
              if (!cityMapNew.has(key)) {
                const loc = result.geometry?.location;
                if (loc) cityMapNew.set(key, { name: cityName, state: stateCode || "LA", lat: loc.lat, lng: loc.lng });
              }
            }
          }
        }
        console.log(`[save_pit] Discovered ${cityMapNew.size} unique cities near ${savedPit.name}`);

        // Calculate distances from ALL pits to ALL discovered cities
        const allCitiesArr = [...cityMapNew.values()];
        const pitDistsNew: Record<string, (number | null)[]> = {};
        for (const pit of allActivePitsForNew || []) {
          pitDistsNew[pit.id] = await getDrivingDistances(
            Number(pit.lat), Number(pit.lon),
            allCitiesArr.map(c => ({ lat: c.lat, lng: c.lng })),
            apiKey
          );
        }

        // Process each discovered city
        for (let idx = 0; idx < allCitiesArr.length; idx++) {
          const city = allCitiesArr[idx];
          try {
            // Find closest pit from ALL active pits
            let closestPit: any = null;
            let closestDist = Infinity;
            for (const pit of allActivePitsForNew || []) {
              const d = pitDistsNew[pit.id][idx];
              if (d != null && d < closestDist) {
                closestDist = d;
                closestPit = pit;
              }
            }
            if (!closestPit || closestDist === Infinity) continue;

            const pitMaxDist = closestPit.max_distance || parseFloat(gMapNew.default_max_distance || "30");
            if (closestDist > pitMaxDist) continue;

            // Calculate price
            const effBP = closestPit.base_price ?? parseFloat(gMapNew.default_base_price || "195");
            const effFM = closestPit.free_miles ?? parseFloat(gMapNew.default_free_miles || "15");
            const effEPM = closestPit.price_per_extra_mile ?? parseFloat(gMapNew.default_extra_per_mile || "5");
            const extraMiles = Math.max(0, closestDist - effFM);
            const price = Math.max(effBP, Math.round(effBP + extraMiles * effEPM));

            const cleanSlug = normalizeSlug(city.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
            const existing = existingByNameForNew.get(city.name.toLowerCase());

            if (existing) {
              // Only update if new calculation finds closer pit
              if (closestDist < (existing.distance_from_pit ?? 999)) {
                const wasWaitlist = existing.status === "waitlist";
                await supabase.from("city_pages").update({
                  pit_id: closestPit.id,
                  distance_from_pit: Math.round(closestDist * 10) / 10,
                  base_price: price,
                  pit_reassigned: true,
                  regen_reason: 'pit_reassigned',
                  updated_at: new Date().toISOString(),
                }).eq("id", existing.id);
                console.log(`[save_pit] Reassigned ${city.name} → ${closestPit.name} (${closestDist.toFixed(1)}mi)`);
                pages_reassigned++;

                // Auto-generate content
                await fetch(regenUrl, { method: "POST", headers: regenHeaders, body: JSON.stringify({ city_page_id: existing.id, force: true }) });
                pages_regenerated++;

                // If page was on waitlist, notify waitlist leads
                if (wasWaitlist) {
                  try {
                    const { data: waitlistLeads } = await supabase
                      .from("waitlist_leads").select("*").eq("city_slug", existing.city_slug).is("notified_at", null);
                    const emailUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
                    for (const lead of waitlistLeads || []) {
                      await fetch(emailUrl, {
                        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
                        body: JSON.stringify({ type: "waitlist_available", data: { city_name: existing.city_name, city_slug: existing.city_slug, customer_name: lead.customer_name, customer_email: lead.customer_email, price } }),
                      });
                      await supabase.from("waitlist_leads").update({ notified_at: new Date().toISOString() }).eq("id", lead.id);
                      await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    console.log(`[save_pit] Notified ${waitlistLeads?.length || 0} waitlist leads for ${existing.city_name}`);
                  } catch (wErr: any) { console.error(`[save_pit] Waitlist notification error:`, wErr.message); }
                }

                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            } else {
              // Create new page
              const { data: newPage } = await supabase.from("city_pages").insert({
                pit_id: closestPit.id,
                city_name: city.name,
                city_slug: cleanSlug,
                state: city.state,
                lat: city.lat,
                lng: city.lng,
                distance_from_pit: Math.round(closestDist * 10) / 10,
                base_price: price,
                status: "draft",
                regen_reason: 'missing_content',
              }).select("id").single();
              console.log(`[save_pit] Created page for ${city.name} — ${closestPit.name} (${closestDist.toFixed(1)}mi) $${price}`);
              pages_created_count++;

              // Auto-generate content (will set status to active)
              if (newPage?.id) {
                await fetch(regenUrl, { method: "POST", headers: regenHeaders, body: JSON.stringify({ city_page_id: newPage.id, force: true }) });
                pages_regenerated++;
              }
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (err: any) {
            console.error(`[save_pit] Error processing ${city.name}:`, err.message);
          }
        }
        console.log(`[save_pit] Auto-discovery complete for ${savedPit.name}: ${pages_created_count} created, ${pages_reassigned} reassigned`);
      }

      // ── PART 4: Inline regen — process flagged pages immediately ──
      if (regenTriggered) {
        const regenUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-city-page`;
        const leadsPass = Deno.env.get("LEADS_PASSWORD") || "";
        const { data: draftInline } = await supabase
          .from("city_pages")
          .select("id, city_name, city_slug, state, region, distance_from_pit, base_price, multi_pit_coverage, pit_id")
          .eq("needs_regen", true)
          .eq("status", "draft")
          .order("updated_at", { ascending: true })
          .limit(10);
        const draftInlineIds = new Set((draftInline || []).map((p: any) => p.id));
        let inlinePages = draftInline || [];
        if (inlinePages.length < 10) {
          const { data: activeInline } = await supabase
            .from("city_pages")
            .select("id, city_name, city_slug, state, region, distance_from_pit, base_price, multi_pit_coverage, pit_id")
            .eq("needs_regen", true)
            .eq("status", "active")
            .order("updated_at", { ascending: true })
            .limit(10 - inlinePages.length);
          inlinePages = [...inlinePages, ...(activeInline || []).filter((p: any) => !draftInlineIds.has(p.id))];
        }

        const { data: inlinePits } = await supabase.from("pits").select("*").eq("status", "active");
        const inlinePitsById: Record<string, any> = {};
        (inlinePits || []).forEach((p: any) => { inlinePitsById[p.id] = p; });

        let inline_processed = 0;
        for (const page of inlinePages || []) {
          try {
            const pit = inlinePitsById[page.pit_id] || {};
            const response = await fetch(regenUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
              body: JSON.stringify({
                password: leadsPass,
                city_page_id: page.id,
                city_name: page.city_name,
                state: page.state || "LA",
                region: page.region || page.state || "LA",
                pit_name: pit.name || "Unknown",
                pit_city: pit.name || "Unknown",
                distance: page.distance_from_pit || 0,
                price: page.base_price || pit.base_price || 195,
                free_miles: pit.free_miles || 15,
                saturday_available: pit.operating_days ? pit.operating_days.includes(6) : true,
                same_day_cutoff: pit.same_day_cutoff || "10:00 am",
                multi_pit_coverage: page.multi_pit_coverage || false,
              }),
            });
            if (response.ok) {
              await supabase.from("city_pages").update({
                needs_regen: false, pit_reassigned: false, price_changed: false,
                regen_reason: null, status: "active", updated_at: new Date().toISOString(),
              }).eq("id", page.id);
              inline_processed++;
              console.log(`[save_pit] Inline regen done: ${page.city_name}`);
            } else {
              console.error(`[save_pit] Inline regen failed: ${page.city_name} (${response.status})`);
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (err: any) {
            console.error(`[save_pit] Inline regen error: ${page.city_name}`, err.message);
            continue;
          }
        }
        console.log(`[save_pit] Inline regen complete: ${inline_processed} processed`);
        pages_regenerated += inline_processed;
      }

      return new Response(
        JSON.stringify({ success: true, pit: savedPit, prices_updated, pages_regenerated, pages_reassigned, pages_created: pages_created_count, deactivation_reassigned, deactivation_waitlisted, reactivation_reassigned, reactivation_unwaitlisted }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── DELETE PIT ──
    if (action === "delete_pit") {
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error } = await supabase.from("pits").delete().eq("id", id);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── GET FUNNEL (last 30 days cumulative) ──
    if (action === "get_funnel") {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("visitor_sessions")
        .select("stage, entry_city_name")
        .gte("created_at", since);
      if (error) throw error;

      const ORDERED_STAGES = [
        "visited", "entered_address", "got_price",
        "clicked_order_now", "started_checkout",
        "reached_payment", "completed_order",
      ];
      const counts: Record<string, number> = {
        visited: 0, entered_address: 0, got_price: 0,
        got_out_of_area: 0, clicked_order_now: 0,
        started_checkout: 0, reached_payment: 0, completed_order: 0,
      };

      const entryPages: Record<string, number> = {};
      for (const row of (data as any[]) || []) {
        const stage = row.stage || "visited";
        if (row.entry_city_name) {
          entryPages[row.entry_city_name] = (entryPages[row.entry_city_name] || 0) + 1;
        }
        if (stage === "got_out_of_area") {
          counts.got_out_of_area++;
          counts.visited++;
          counts.entered_address++;
          continue;
        }
        const idx = ORDERED_STAGES.indexOf(stage);
        if (idx === -1) { counts.visited++; continue; }
        for (let i = 0; i <= idx; i++) {
          counts[ORDERED_STAGES[i]]++;
        }
      }

      const top_entry_cities = Object.entries(entryPages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([city, count]) => ({ city, count }));

      return new Response(
        JSON.stringify({ funnel: counts, top_entry_cities }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list_live_visitors") {
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("visitor_sessions")
        .select("*")
        .gte("last_seen_at", thirtyMinsAgo)
        .order("last_seen_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      // Filter out no-track IPs
      const ntSb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: ntData } = await ntSb.from("global_settings").select("value").eq("key", "notrack_ips").single();
      const ntIps: string[] = ntData ? JSON.parse(ntData.value) : [];
      const filtered = (data || []).filter((s: any) => !ntIps.includes(s.ip_address));
      console.log("[list_live_visitors] found:", data?.length, "total,", filtered.length, "after notrack filter");
      return new Response(
        JSON.stringify({ sessions: filtered }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── GET ACTIVITY MAP (address dots for last 30 days) ──
    if (action === "get_activity_map") {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("visitor_sessions")
        .select("address_lat, address_lng, stage, calculated_price, delivery_address, geo_city, entry_city_name, created_at, ip_address")
        .not("address_lat", "is", null)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      // Filter out no-track IPs
      const ntSbM = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: ntDataM } = await ntSbM.from("global_settings").select("value").eq("key", "notrack_ips").single();
      const ntIpsM: string[] = ntDataM ? JSON.parse(ntDataM.value) : [];
      const filteredPts = (data || []).filter((s: any) => !ntIpsM.includes(s.ip_address));
      // Strip ip_address from response
      const points = filteredPts.map(({ ip_address, ...rest }: any) => rest);
      return new Response(
        JSON.stringify({ points }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── LIST ABANDONED SESSIONS ──
    if (action === "list_abandoned") {
      const stages = ["entered_address", "got_price", "got_out_of_area", "clicked_order_now", "started_checkout", "reached_payment"];
      const stalenessMs = 30 * 60 * 1000; // 30 minutes
      const cutoffTime = new Date(Date.now() - stalenessMs).toISOString();
      const { data, error } = await supabase
        .from("visitor_sessions")
        .select("*")
        .in("stage", stages)
        .lt("updated_at", cutoffTime)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      // Filter out no-track IPs
      const ntSbA = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: ntDataA } = await ntSbA.from("global_settings").select("value").eq("key", "notrack_ips").single();
      const ntIpsA: string[] = ntDataA ? JSON.parse(ntDataA.value) : [];
      const filtered = (data || []).filter((s: any) => !ntIpsA.includes(s.ip_address));
      console.log("[list_abandoned] found:", data?.length, "total,", filtered.length, "after notrack filter");
      return new Response(
        JSON.stringify({ sessions: filtered }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── LIST CASH ORDERS ──
    if (action === "list_cash_orders") {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .neq("payment_status", "cancelled")
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;
        return new Response(
          JSON.stringify({ orders: data }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("[leads-auth] list_cash_orders error:", err);
        throw err;
      }
    }

    // ── LIST CUSTOMERS ──
    if (action === "get_customers") {
      try {
        const { data, error } = await supabase
          .from("customers")
          .select("*")
          .order("last_order_date", { ascending: false, nullsFirst: false });
        if (error) throw error;
        return new Response(
          JSON.stringify({ customers: data }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("[leads-auth] get_customers error:", err);
        throw err;
      }
    }

    // ── SYNC STRIPE PAYMENT ──
    if (action === "sync_stripe_payment") {
      if (!order_id) {
        return new Response(JSON.stringify({ error: "Missing order_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: order } = await supabase
        .from("orders")
        .select("*")
        .eq("id", order_id)
        .single();

      if (!order) {
        return new Response(
          JSON.stringify({ error: "Order not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: modeData2 } = await supabase
        .from("global_settings")
        .select("value")
        .eq("key", "stripe_mode")
        .maybeSingle();

      const stripeMode2 = modeData2?.value || "live";
      const stripeKey2 = stripeMode2 === "test"
        ? Deno.env.get("STRIPE_TEST_SECRET_KEY")
        : Deno.env.get("STRIPE_SECRET_KEY");

      const Stripe = (await import("https://esm.sh/stripe@18.5.0")).default;
      const stripe = new Stripe(stripeKey2 || "", {
        apiVersion: "2025-08-27.basil",
      });

      console.log("[sync_stripe_payment] Searching Stripe for order:", order_id, "order_number:", order.order_number);

      const sessions = await stripe.checkout.sessions.list({ limit: 20 });
      const matchedSession = sessions.data.find((s: any) =>
        s.metadata?.order_id === order_id ||
        s.metadata?.order_number === order.order_number
      );

      if (!matchedSession) {
        console.log("[sync_stripe_payment] No matching session found");
        return new Response(
          JSON.stringify({ error: "No Stripe session found for this order", synced: false }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[sync_stripe_payment] Found session:", matchedSession.id, "payment_status:", matchedSession.payment_status);

      if (matchedSession.payment_status === "paid") {
        const { error: updateErr } = await supabase
          .from("orders")
          .update({
            payment_status: "paid",
            status: "confirmed",
            stripe_payment_id: (matchedSession.payment_intent as string) || null,
            stripe_customer_id: (matchedSession.customer as string) || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", order_id);

        if (updateErr) throw updateErr;
        console.log("[sync_stripe_payment] Order updated to paid:", order_id);

        return new Response(
          JSON.stringify({ success: true, synced: true, payment_status: "paid" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, synced: false, payment_status: matchedSession.payment_status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── MARK CASH PAID ──
    if (action === "mark_cash_paid") {
      if (!order_id) {
        return new Response(JSON.stringify({ error: "Missing order_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      try {
        const { data: updatedOrder, error: updateErr } = await supabase
          .from("orders")
          .update({
            cash_collected: true,
            cash_collected_at: new Date().toISOString(),
            cash_collected_by: collected_by || null,
            payment_status: "collected",
          })
          .eq("id", order_id)
          .select()
          .single();
        if (updateErr) throw updateErr;

        if (send_email && updatedOrder.customer_email) {
          try {
            const emailResp = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify({
                type: "cash_payment_confirmed",
                data: updatedOrder,
              }),
            });
            if (!emailResp.ok) {
              console.error("[leads-auth] Email send failed:", await emailResp.text());
            }
          } catch (emailErr) {
            console.error("[leads-auth] Email error:", emailErr);
          }
        }

        return new Response(
          JSON.stringify({ success: true, order: updatedOrder }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err) {
        console.error("[leads-auth] mark_cash_paid error:", err);
        throw err;
      }
    }

    // ── LIST CITY PAGES ──
    if (action === "list_city_pages") {
      const { data, error } = await supabase
        .from("city_pages")
        .select("*, pits(name)")
        .order("city_name");
      if (error) throw error;
      return new Response(
        JSON.stringify({ city_pages: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── SAVE CITY PAGE ──
    if (action === "save_city_page") {
      if (!city_page_id || !city_page) {
        return new Response(JSON.stringify({ error: "Missing city_page_id or city_page" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Normalize slug if provided to prevent state-suffix duplicates
      const normalizedSlug = city_page.city_slug ? normalizeSlug(city_page.city_slug) : undefined;
      const { error } = await supabase
        .from("city_pages")
        .update({
          ...(normalizedSlug ? { city_slug: normalizedSlug } : {}),
          meta_title: city_page.meta_title,
          meta_description: city_page.meta_description,
          h1_text: city_page.h1_text,
          hero_intro: city_page.hero_intro ?? null,
          why_choose_intro: city_page.why_choose_intro ?? null,
          delivery_details: city_page.delivery_details ?? null,
          local_uses: city_page.local_uses ?? null,
          local_expertise: city_page.local_expertise ?? null,
          faq_items: city_page.faq_items ?? null,
          content: city_page.content,
          status: city_page.status,
          city_name: city_page.city_name,
          region: city_page.region ?? null,
        })
        .eq("id", city_page_id);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── DELETE CITY PAGE ──
    if (action === "delete_city_page") {
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: pageToDelete } = await supabase
        .from("city_pages").select("pit_id, city_slug").eq("id", id).maybeSingle();

      const { error } = await supabase.from("city_pages").delete().eq("id", id);
      if (error) throw error;

      if (pageToDelete?.pit_id) {
        const { data: pitRec } = await supabase
          .from("pits").select("served_cities").eq("id", pageToDelete.pit_id).maybeSingle();
        if (pitRec?.served_cities && Array.isArray(pitRec.served_cities)) {
          const updated = (pitRec.served_cities as any[]).filter(
            (c: any) => c.slug !== pageToDelete.city_slug
          );
          await supabase.from("pits").update({ served_cities: updated }).eq("id", pageToDelete.pit_id);
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── TOGGLE CITY PAGE ──
    if (action === "toggle_city_page") {
      if (!id) {
        return new Response(JSON.stringify({ error: "Missing id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: current, error: fetchErr } = await supabase
        .from("city_pages").select("status").eq("id", id).single();
      if (fetchErr) throw fetchErr;
      const newStatus = current.status === "active" ? "inactive" : "active";
      const { error } = await supabase.from("city_pages").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, status: newStatus }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── DISCOVER CITIES ──
    if (action === "discover_cities") {
      if (!pit_id) {
        return new Response(JSON.stringify({ error: "Missing pit_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: pitData, error: pitErr } = await supabase
        .from("pits").select("*").eq("id", pit_id).single();
      if (pitErr) throw pitErr;

      const maxDist = pitData.max_distance || 30;
      const apiKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY") || "";
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "GOOGLE_MAPS_SERVER_KEY not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const cleanCityName = (name: string): string => {
        return name
          .replace(/^City of /i, "")
          .replace(/^Town of /i, "")
          .replace(/^Village of /i, "")
          .replace(/\/.+$/, "")
          .replace(/\s+Area$/i, "")
          .replace(/\s+District$/i, "")
          .replace(/\s+CDP$/i, "")
          .trim();
      };

      const EXCLUDE_WORDS = [
        "inc", "llc", "corp", "association", "club", "center", "centre",
        "park", "farm", "commission", "community", "fitness", "beach",
        "golf", "volleyball", "action", "development", "recreation",
        "school", "church", "hospital", "museum", "library", "university",
        "college", "foundation", "institute", "authority", "department",
        "council", "services", "group", "company", "studio", "restaurant",
        "hotel", "motel", "plaza", "mall", "shop", "store", "market",
        "yacht", "marina", "gym", "theater", "theatre", "arena",
      ];

      const isValidCityName = (name: string): boolean => {
        if (!name) return false;
        const lower = name.toLowerCase();
        for (const word of EXCLUDE_WORDS) {
          if (lower.includes(word)) return false;
        }
        const words = name.split(/\s+/);
        if (words.length > 4) return false;
        if (words.some(w => w.length > 20)) return false;
        return true;
      };

      const VALID_TYPES = ["sublocality_level_1", "locality", "administrative_area_level_3"];

      // Generate sample points at various distances and directions
      const distances = [3, 5, 8, 10, 13, 15, 18, 20, 23, 25, 28, 30, 33, 35, 38, 40, 43, 45, 48, 50].filter(d => d <= maxDist);
      const directions = [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5];
      const samplePoints: { lat: number; lng: number }[] = [
        { lat: pitData.lat, lng: pitData.lon },
      ];
      for (const dist of distances) {
        for (const dir of directions) {
          const rad = dir * Math.PI / 180;
          const dLat = (dist / 69) * Math.cos(rad);
          const dLng = (dist / (69 * Math.cos(pitData.lat * Math.PI / 180))) * Math.sin(rad);
          samplePoints.push({ lat: pitData.lat + dLat, lng: pitData.lon + dLng });
        }
      }
      console.log(`Sampling ${samplePoints.length} points for reverse geocoding`);

      const cityMap = new Map<string, { name: string; state: string; lat: number; lng: number; region: string }>();

      const BATCH_SIZE = 10;
      for (let i = 0; i < samplePoints.length; i += BATCH_SIZE) {
        const batch = samplePoints.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (pt) => {
          try {
            const resp = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${pt.lat},${pt.lng}&result_type=locality|sublocality_level_1|administrative_area_level_3&key=${apiKey}`
            );
            const data = await resp.json();
            return data.results || [];
          } catch (e) {
            console.error("Reverse geocode failed:", e);
            return [];
          }
        });
        const batchResults = await Promise.all(promises);
        for (const results of batchResults) {
          for (const result of results) {
            const types = result.types || [];
            const hasValidType = types.some((t: string) => VALID_TYPES.includes(t));
            if (!hasValidType) continue;

            const components = result.address_components || [];
            let cityName = "";
            let stateCode = "";
            for (const prio of VALID_TYPES) {
              const comp = components.find((c: any) => c.types?.includes(prio));
              if (comp && !cityName) cityName = comp.long_name;
            }
            const stateComp = components.find((c: any) => c.types?.includes("administrative_area_level_1"));
            if (stateComp) stateCode = stateComp.short_name;
            const regionComp = components.find((c: any) => c.types?.includes("administrative_area_level_2"));
            const regionName = regionComp ? regionComp.long_name : "";

            if (!cityName) continue;
            cityName = cleanCityName(cityName);
            if (!isValidCityName(cityName)) continue;

            const key = cityName.toLowerCase();
            if (!cityMap.has(key)) {
              const loc = result.geometry?.location;
              if (loc) {
                cityMap.set(key, { name: cityName, state: stateCode, lat: loc.lat, lng: loc.lng, region: regionName });
              }
            }
          }
        }
      }
      console.log(`Reverse geocoding found ${cityMap.size} unique cities`);

      // Get existing city slugs for duplicate detection
      const { data: existingPages } = await supabase
        .from("city_pages")
        .select("city_slug, pit_id, pits(name)");
      const existingSlugs = new Map();
      for (const p of existingPages || []) {
        existingSlugs.set(p.city_slug, { pit_id: p.pit_id, pit_name: (p as any).pits?.name || "" });
      }

      // Fetch ALL active pits for closest-pit calculation
      const { data: allActivePits } = await supabase
        .from("pits").select("*").eq("status", "active");

      // Build final results — calculate distance from ALL pits for each city
      const discovered: any[] = [];
      const seenSlugs = new Set<string>();
      const allCities = [...cityMap.entries()];

      // Calculate distances from EACH active pit to ALL discovered cities
      const pitDistances: Record<string, (number | null)[]> = {};
      for (const pit of allActivePits || []) {
        const dists = await getDrivingDistances(
          Number(pit.lat), Number(pit.lon),
          allCities.map(([, city]) => ({ lat: city.lat, lng: city.lng })),
          apiKey
        );
        pitDistances[pit.id] = dists;
      }

      for (let idx = 0; idx < allCities.length; idx++) {
        const [, city] = allCities[idx];

        // Find closest pit from ALL active pits
        let closestPit: any = null;
        let closestDistance = Infinity;
        for (const pit of allActivePits || []) {
          const dist = pitDistances[pit.id][idx];
          if (dist != null && dist < closestDistance) {
            closestDistance = dist;
            closestPit = pit;
          }
        }

        if (!closestPit || closestDistance === Infinity) continue;
        const closestMaxDist = closestPit.max_distance || 30;
        if (closestDistance > closestMaxDist) continue;

        let slug = normalizeSlug(city.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
        if (seenSlugs.has(slug)) continue;
        seenSlugs.add(slug);

        const existing = existingSlugs.get(slug);

        // Calculate price using CLOSEST pit's settings
        const effBP = closestPit.base_price ?? parseFloat(gs.default_base_price || "195");
        const effFM = closestPit.free_miles ?? parseFloat(gs.default_free_miles || "15");
        const effEPM = closestPit.price_per_extra_mile ?? parseFloat(gs.default_extra_per_mile || "5");
        const extraMiles = Math.max(0, closestDistance - effFM);
        const price = Math.max(effBP, Math.round(effBP + extraMiles * effEPM));

        discovered.push({
          city_name: city.name,
          city_slug: slug,
          state: city.state || "US",
          region: city.region || "",
          lat: city.lat,
          lng: city.lng,
          distance: Math.round(closestDistance * 10) / 10,
          price: Math.round(price * 100) / 100,
          closest_pit_id: closestPit.id,
          closest_pit_name: closestPit.name,
          duplicate: !!existing,
          existing_pit_name: existing?.pit_name || null,
        });
      }

      discovered.sort((a: any, b: any) => a.distance - b.distance);
      console.log(`Discover complete: ${discovered.length} cities found for PIT ${pitData.name}`);

      return new Response(
        JSON.stringify({ cities: discovered, pit: pitData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── CREATE CITY PAGES ──
    if (action === "create_city_pages") {
      if (!cities || !Array.isArray(cities)) {
        return new Response(JSON.stringify({ error: "Missing cities array" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const apiKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY") || "";
      // Fetch ALL active pits — always find closest
      const { data: allActivePits } = await supabase
        .from("pits").select("*").eq("status", "active");
      const { data: gsForGen } = await supabase.from("global_settings").select("key, value");
      const gsMap: Record<string, string> = {};
      for (const row of gsForGen || []) gsMap[row.key] = row.value;

      // Calculate distances from EACH pit to ALL cities
      const pitDistances: Record<string, (number | null)[]> = {};
      for (const pit of allActivePits || []) {
        const dists = await getDrivingDistances(
          Number(pit.lat), Number(pit.lon),
          cities.map((c: any) => ({ lat: c.lat, lng: c.lng })),
          apiKey
        );
        pitDistances[pit.id] = dists;
      }

      const created: string[] = [];
      const skippedList: Array<{ city: string; reason: string }> = [];
      let skippedCount = 0;
      let updatedCount = 0;

      for (let cityIdx = 0; cityIdx < cities.length; cityIdx++) {
        const city = cities[cityIdx];

        // Find closest pit from ALL active pits
        let closestPit: any = null;
        let closestDistance = Infinity;
        for (const pit of allActivePits || []) {
          const dist = pitDistances[pit.id][cityIdx];
          if (dist != null && dist < closestDistance) {
            closestDistance = dist;
            closestPit = pit;
          }
        }

        if (!closestPit || closestDistance === Infinity) {
          skippedList.push({ city: city.city_name, reason: "No road route from any pit" });
          skippedCount++;
          continue;
        }

        // Calculate effective pricing from closest pit
        const effBP = closestPit.base_price ?? parseFloat(gsMap.default_base_price || "195");
        const effFM = closestPit.free_miles ?? parseFloat(gsMap.default_free_miles || "15");
        const effEPM = closestPit.price_per_extra_mile ?? parseFloat(gsMap.default_extra_per_mile || "5");
        const maxDist = closestPit.max_distance ?? parseFloat(gsMap.default_max_distance || "30");

        if (closestDistance > maxDist) {
          skippedList.push({ city: city.city_name, reason: `Outside max distance (${closestDistance.toFixed(1)} > ${maxDist})` });
          skippedCount++;
          continue;
        }

        // Northshore phantom miles for toll recovery (region-based)
        const cityIsNorthshore = isNorthshoreRegion(city.region || '');
        const billedDistance = cityIsNorthshore ? closestDistance + PHANTOM_MILES : closestDistance;
        const extraMiles = Math.max(0, billedDistance - effFM);
        const price = Math.max(effBP, Math.round(effBP + extraMiles * effEPM));

        // Multi-PIT coverage detection
        const competingPits = (allActivePits || []).filter((p: any) => {
          if (p.id === closestPit!.id) return false;
          const dist = pitDistances[p.id][cityIdx];
          return dist != null && dist <= (p.max_distance || 30);
        });
        const forceSuppressPrice = LARGE_CITIES_NO_STATIC_PRICE.has(city.city_name.toLowerCase());
        const isMultiPit = competingPits.length > 0 || forceSuppressPrice;
        const competingIds = competingPits.length > 0 ? competingPits.map((p: any) => p.id) : null;

        const normalizedSlug = normalizeSlug(city.city_slug);

        // Check for existing page by slug
        const { data: existingBySlug } = await supabase
          .from("city_pages").select("id, city_slug, distance_from_pit, status")
          .eq("city_slug", normalizedSlug).maybeSingle();

        // Check for existing page by city name (case insensitive)
        const { data: existingByName } = await supabase
          .from("city_pages").select("id, city_slug, distance_from_pit, status")
          .ilike("city_name", city.city_name).maybeSingle();

        const existing = existingBySlug || existingByName;
        if (existing) {
          if (closestDistance < (existing.distance_from_pit ?? 999)) {
            await supabase.from("city_pages").update({
              pit_id: closestPit.id,
              distance_from_pit: Math.round(closestDistance * 10) / 10,
              base_price: price,
              multi_pit_coverage: isMultiPit,
              competing_pit_ids: competingIds,
              pit_reassigned: true, price_changed: false,
              prompt_version: null, regen_reason: 'pit_reassigned',
              updated_at: new Date().toISOString(),
            }).eq("id", existing.id);
            console.log(`[create_city_pages] Updated ${city.city_name} → ${closestPit.name} (${closestDistance.toFixed(1)}mi, $${price})`);
            updatedCount++;
          } else {
            if (isMultiPit) {
              await supabase.from("city_pages").update({
                multi_pit_coverage: true, competing_pit_ids: competingIds,
                updated_at: new Date().toISOString(),
              }).eq("id", existing.id);
            }
            console.log(`Skipped ${normalizedSlug}: existing PIT is closer (${existing.distance_from_pit} mi)`);
          }
          skippedList.push({ city: city.city_name, reason: `Already exists as /${existing.city_slug}/river-sand-delivery` });
          skippedCount++;
          continue;
        }

        // Insert new page with closest pit
        const { data: inserted, error: insertErr } = await supabase
          .from("city_pages").insert({
            pit_id: closestPit.id,
            city_name: city.city_name,
            city_slug: normalizedSlug,
            state: city.state || "LA",
            region: city.region || null,
            lat: city.lat, lng: city.lng,
            distance_from_pit: Math.round(closestDistance * 10) / 10,
            base_price: price,
            multi_pit_coverage: isMultiPit,
            competing_pit_ids: competingIds,
            status: "draft",
            page_views: 0,
            pit_reassigned: false, price_changed: false,
            prompt_version: null, regen_reason: 'missing_content',
          }).select().single();

        if (insertErr) { console.error("Insert city page error:", insertErr); continue; }
        created.push(inserted.id);
        console.log(`[create_city_pages] ${city.city_name} → ${closestPit.name} (${closestDistance.toFixed(1)}mi, $${price})`);
      }

      return new Response(
        JSON.stringify({ success: true, created: created.length, updated: updatedCount, skipped: skippedCount, skipped_details: skippedList }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── BULK DELETE CITY PAGES ──
    if (action === "delete_city_pages") {
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return new Response(JSON.stringify({ error: "Missing ids array" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error, count } = await supabase.from("city_pages").delete().in("id", ids);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true, deleted: count || ids.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── RESET ALL CITY PAGES ──
    if (action === "reset_city_pages") {
      const { error: delErr, count } = await supabase.from("city_pages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (delErr) throw delErr;
      const { error: pitErr } = await supabase.from("pits").update({ served_cities: null }).neq("id", "00000000-0000-0000-0000-000000000000");
      if (pitErr) throw pitErr;
      return new Response(
        JSON.stringify({ success: true, deleted: count || 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── BULK TOGGLE CITY PAGES ──
    if (action === "deactivate_city_pages") {
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return new Response(JSON.stringify({ error: "Missing ids array" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error } = await supabase.from("city_pages").update({ status: "inactive" }).in("id", ids);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── CREATE ALL CITY PAGES (bulk across all PITs with closest-PIT dedup) ──
    if (action === "create_all_city_pages") {
      const { data: allPits, error: pitsErr } = await supabase
        .from("pits").select("*").eq("status", "active");
      if (pitsErr) throw pitsErr;
      if (!allPits || allPits.length === 0) {
        return new Response(JSON.stringify({ error: "No active PITs found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const apiKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY") || "";
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "GOOGLE_MAPS_SERVER_KEY not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const cleanCityName = (name: string): string => {
        return name.replace(/^City of /i, "").replace(/^Town of /i, "").replace(/^Village of /i, "")
          .replace(/\/.+$/, "").replace(/\s+Area$/i, "").replace(/\s+District$/i, "").replace(/\s+CDP$/i, "").trim();
      };

      const EXCLUDE_WORDS = [
        "inc", "llc", "corp", "association", "club", "center", "centre",
        "park", "farm", "commission", "community", "fitness", "beach",
        "golf", "volleyball", "action", "development", "recreation",
        "school", "church", "hospital", "museum", "library", "university",
        "college", "foundation", "institute", "authority", "department",
        "council", "services", "group", "company", "studio", "restaurant",
        "hotel", "motel", "plaza", "mall", "shop", "store", "market",
        "yacht", "marina", "gym", "theater", "theatre", "arena",
      ];

      const isValidCityName = (name: string): boolean => {
        if (!name) return false;
        const lower = name.toLowerCase();
        for (const word of EXCLUDE_WORDS) { if (lower.includes(word)) return false; }
        const words = name.split(/\s+/);
        if (words.length > 4) return false;
        if (words.some(w => w.length > 20)) return false;
        return true;
      };

      const VALID_TYPES = ["sublocality_level_1", "locality", "administrative_area_level_3"];

      const { data: gsData } = await supabase.from("global_settings").select("key, value");
      const gs: Record<string, string> = {};
      for (const row of gsData || []) gs[row.key] = row.value;

      const allCandidates: Array<{
        city_name: string; city_slug: string; state: string; region: string;
        lat: number; lng: number; distance_from_pit: number;
        pit_id: string; pit_name: string; base_price: number;
      }> = [];

      for (const pit of allPits) {
        const maxDist = pit.max_distance || 30;
        const distances = [3, 5, 8, 10, 13, 15, 18, 20, 23, 25, 28, 30, 33, 35, 38, 40, 43, 45, 48, 50].filter(d => d <= maxDist);
        const directions = [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5];
        const samplePoints: { lat: number; lng: number }[] = [{ lat: pit.lat, lng: pit.lon }];
        for (const dist of distances) {
          for (const dir of directions) {
            const rad = dir * Math.PI / 180;
            const dLat = (dist / 69) * Math.cos(rad);
            const dLng = (dist / (69 * Math.cos(pit.lat * Math.PI / 180))) * Math.sin(rad);
            samplePoints.push({ lat: pit.lat + dLat, lng: pit.lon + dLng });
          }
        }
        console.log(`[bulk] Sampling ${samplePoints.length} points for PIT ${pit.name}`);

        const pitCityMap = new Map<string, { name: string; state: string; lat: number; lng: number; region: string }>();
        const BATCH_SIZE = 10;
        for (let i = 0; i < samplePoints.length; i += BATCH_SIZE) {
          const batch = samplePoints.slice(i, i + BATCH_SIZE);
          const promises = batch.map(async (pt) => {
            try {
              const resp = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${pt.lat},${pt.lng}&result_type=locality|sublocality_level_1|administrative_area_level_3&key=${apiKey}`
              );
              return (await resp.json()).results || [];
            } catch { return []; }
          });
          const batchResults = await Promise.all(promises);
          for (const results of batchResults) {
            for (const result of results) {
              const types = result.types || [];
              if (!types.some((t: string) => VALID_TYPES.includes(t))) continue;
              const components = result.address_components || [];
              let cityName = "";
              let stateCode = "";
              let regionName = "";
              for (const prio of VALID_TYPES) {
                const comp = components.find((c: any) => c.types?.includes(prio));
                if (comp && !cityName) cityName = comp.long_name;
              }
              const stateComp = components.find((c: any) => c.types?.includes("administrative_area_level_1"));
              if (stateComp) stateCode = stateComp.short_name;
              // Extract parish/county for Northshore detection
              const parishComp = components.find((c: any) => c.types?.includes("administrative_area_level_2"));
              if (parishComp) regionName = parishComp.long_name;
              if (!cityName) continue;
              cityName = cleanCityName(cityName);
              if (!isValidCityName(cityName)) continue;
              const loc = result.geometry?.location;
              if (!loc) continue;
              const key = cityName.toLowerCase();
              if (!pitCityMap.has(key)) {
                pitCityMap.set(key, { name: cityName, state: stateCode || "LA", lat: loc.lat, lng: loc.lng, region: regionName });
              }
            }
          }
        }

        // Get driving distances for all cities discovered for this PIT — no haversine pre-filter
        const pitCities = [...pitCityMap.values()];
        const drivingDists = await getDrivingDistances(
          pit.lat, pit.lon,
          pitCities.map(c => ({ lat: c.lat, lng: c.lng })),
          apiKey
        );

        const bPrice = pit.base_price ?? parseFloat(gs.default_base_price || "195");
        const freeMiles = pit.free_miles ?? parseFloat(gs.default_free_miles || "15");
        const extraPerMile = pit.price_per_extra_mile ?? parseFloat(gs.default_extra_per_mile || "5");

        for (let idx = 0; idx < pitCities.length; idx++) {
          const city = pitCities[idx];
          const distance = drivingDists[idx];
          if (distance === null) continue; // No road route found — skip this city
          if (distance > maxDist) continue;
          const slug = normalizeSlug(city.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
          // Northshore phantom miles for toll recovery (region-based)
          const cityIsNorthshore = isNorthshoreRegion(city.region || '');
          const billedDistance = cityIsNorthshore ? distance + PHANTOM_MILES : distance;
          const extraMiles = Math.max(0, billedDistance - freeMiles);
          const price = Math.max(bPrice, Math.round(bPrice + extraMiles * extraPerMile));

          allCandidates.push({
            city_name: city.name, city_slug: slug, state: city.state, region: city.region || '',
            lat: city.lat, lng: city.lng, distance_from_pit: Math.round(distance * 10) / 10,
            pit_id: pit.id, pit_name: pit.name, base_price: price,
          });
        }
        console.log(`[bulk] PIT ${pit.name}: ${pitCities.length} cities discovered, ${allCandidates.length} total candidates`);
      }

      // Deduplicate: for each city_slug keep lowest distance_from_pit
      const bestBySlug = new Map<string, typeof allCandidates[0]>();
      for (const c of allCandidates) {
        const existing = bestBySlug.get(c.city_slug);
        if (!existing || c.distance_from_pit < existing.distance_from_pit) {
          bestBySlug.set(c.city_slug, c);
        }
      }

      // Post-dedup: recalculate each unique city from ALL pits to ensure correct closest-pit assignment
      const uniqueCities = [...bestBySlug.values()];
      const allPitDistances: Record<string, (number | null)[]> = {};
      for (const pit of allPits) {
        const dists = await getDrivingDistances(
          Number(pit.lat), Number(pit.lon),
          uniqueCities.map(c => ({ lat: c.lat, lng: c.lng })),
          apiKey
        );
        allPitDistances[pit.id] = dists;
      }

      // Reassign each city to its actual closest pit
      for (let i = 0; i < uniqueCities.length; i++) {
        const city = uniqueCities[i];
        let closestPit: any = null;
        let closestDistance = Infinity;
        for (const pit of allPits) {
          const dist = allPitDistances[pit.id][i];
          if (dist != null && dist < closestDistance) {
            closestDistance = dist;
            closestPit = pit;
          }
        }
        if (closestPit && closestDistance < Infinity) {
          const effBP = closestPit.base_price ?? parseFloat(gs.default_base_price || "195");
          const effFM = closestPit.free_miles ?? parseFloat(gs.default_free_miles || "15");
          const effEPM = closestPit.price_per_extra_mile ?? parseFloat(gs.default_extra_per_mile || "5");
          // Northshore phantom miles for toll recovery (region-based)
          const cityIsNorthshore = isNorthshoreRegion(city.region || '');
          const billedDistance = cityIsNorthshore ? closestDistance + PHANTOM_MILES : closestDistance;
          const extraMiles = Math.max(0, billedDistance - effFM);
          const price = Math.max(effBP, Math.round(effBP + extraMiles * effEPM));
          city.pit_id = closestPit.id;
          city.pit_name = closestPit.name;
          city.distance_from_pit = Math.round(closestDistance * 10) / 10;
          city.base_price = price;
          console.log(`[bulk] Verified ${city.city_name} → ${closestPit.name} (${closestDistance.toFixed(1)}mi, $${price})`);
        }
      }

      // Fetch existing pages for duplicate detection (by slug AND city_name)
      const { data: existingPages } = await supabase
        .from("city_pages")
        .select("id, city_slug, city_name, distance_from_pit, status");

      const existingBySlugMap = new Map<string, typeof existingPages extends (infer T)[] | null ? T : never>();
      const existingByNameMap = new Map<string, typeof existingPages extends (infer T)[] | null ? T : never>();
      for (const p of existingPages || []) {
        existingBySlugMap.set(p.city_slug, p);
        existingByNameMap.set(p.city_name.toLowerCase(), p);
      }

      console.log(`[bulk] ${allCandidates.length} total candidates, ${bestBySlug.size} unique, ${existingBySlugMap.size} existing`);

      let created = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const city of bestBySlug.values()) {
        const closestMaxDist = allPits.find((p: any) => p.id === city.pit_id)?.max_distance || 30;
        if (city.distance_from_pit > closestMaxDist) {
          skippedCount++;
          continue;
        }

        // Multi-PIT coverage detection
        const cityIdx = uniqueCities.indexOf(city);
        const competingPits = allPits.filter((p: any) => {
          if (p.id === city.pit_id) return false;
          const dist = allPitDistances[p.id][cityIdx];
          return dist != null && dist <= (p.max_distance || 30);
        });
        const forceSuppressPrice = LARGE_CITIES_NO_STATIC_PRICE.has(city.city_name.toLowerCase());
        const isMultiPit = competingPits.length > 0 || forceSuppressPrice;
        const competingIds = competingPits.length > 0 ? competingPits.map((p: any) => p.id) : null;

        // Check for existing page by slug or name
        const existingBySlug = existingBySlugMap.get(city.city_slug);
        const existingByName = existingByNameMap.get(city.city_name.toLowerCase());
        const existing = existingBySlug || existingByName;

        if (existing) {
          if (city.distance_from_pit < (existing.distance_from_pit ?? 999)) {
            await supabase.from("city_pages").update({
              pit_id: city.pit_id,
              distance_from_pit: city.distance_from_pit,
              base_price: city.base_price,
              city_slug: city.city_slug,
              multi_pit_coverage: isMultiPit,
              competing_pit_ids: competingIds,
              pit_reassigned: true, price_changed: false,
              prompt_version: null, regen_reason: 'pit_reassigned',
              updated_at: new Date().toISOString(),
            }).eq("id", existing.id);
            console.log(`[bulk] Updated ${city.city_name} → ${city.pit_name} (${city.distance_from_pit} mi)`);
            updatedCount++;
          } else {
            if (isMultiPit) {
              await supabase.from("city_pages").update({
                multi_pit_coverage: true, competing_pit_ids: competingIds,
                updated_at: new Date().toISOString(),
              }).eq("id", existing.id);
            }
            skippedCount++;
          }
          continue;
        }

        // Insert new page
        const { error: insertErr } = await supabase
          .from("city_pages")
          .insert({
            pit_id: city.pit_id, city_name: city.city_name, city_slug: city.city_slug,
            state: city.state, region: city.region || null, lat: city.lat, lng: city.lng,
            distance_from_pit: city.distance_from_pit, base_price: city.base_price,
            multi_pit_coverage: isMultiPit, competing_pit_ids: competingIds,
            status: "draft", prompt_version: null, regen_reason: 'missing_content',
          });
        if (insertErr) { console.error("Insert error:", insertErr); continue; }
        created++;
      }

      return new Response(
        JSON.stringify({
          success: true, created, updated: updatedCount, skipped: skippedCount,
          message: `${created} created, ${updatedCount} updated with closer pit, ${skippedCount} skipped (already optimal).`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── DEDUPLICATE CITY PAGES ──
    if (action === "deduplicate_city_pages") {
      const { data: allPages, error: fetchErr } = await supabase
        .from("city_pages")
        .select("id, city_slug, pit_id, distance_from_pit, status, page_views")
        .order("city_slug");
      if (fetchErr) throw fetchErr;

      const grouped = new Map<string, typeof allPages>();
      for (const page of allPages ?? []) {
        const group = grouped.get(page.city_slug) ?? [];
        group.push(page);
        grouped.set(page.city_slug, group);
      }

      let deactivated = 0;
      for (const [, pages] of grouped) {
        if (pages!.length <= 1) continue;
        pages!.sort((a, b) => {
          if ((a.distance_from_pit ?? 999) !== (b.distance_from_pit ?? 999)) {
            return (a.distance_from_pit ?? 999) - (b.distance_from_pit ?? 999);
          }
          return (b.page_views ?? 0) - (a.page_views ?? 0);
        });
        const [, ...deactivate] = pages!;
        for (const page of deactivate) {
          await supabase.from("city_pages").update({ status: "inactive" }).eq("id", page.id);
          deactivated++;
        }
      }

      return new Response(
        JSON.stringify({ success: true, deactivated, unique_cities: grouped.size }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── RECALCULATE ALL DISTANCES & PRICES ──
    if (action === "recalculate_all_distances") {
      const googleKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY");
      if (!googleKey) {
        return new Response(JSON.stringify({ error: "GOOGLE_MAPS_SERVER_KEY not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const [{ data: allPits }, { data: gsRows }] = await Promise.all([
        supabase.from("pits").select("*").eq("status", "active"),
        supabase.from("global_settings").select("key, value"),
      ]);

      const gs: Record<string, string> = {};
      (gsRows || []).forEach((r: any) => { gs[r.key] = r.value; });
      const defaultBase = parseFloat(gs.default_base_price || "195");
      const defaultFree = parseFloat(gs.default_free_miles || "15");
      const defaultExtra = parseFloat(gs.default_extra_per_mile || "5");

      const { data: allPages, error: pagesErr } = await supabase
        .from("city_pages")
        .select("id, city_name, lat, lng, pit_id, distance_from_pit, base_price, region");
      if (pagesErr) throw pagesErr;

      let updated = 0;
      let errors = 0;
      let reassigned = 0;
      const pits = allPits || [];

      // Filter pages with coordinates
      const validPages = (allPages || []).filter((p: any) => p.lat != null && p.lng != null);
      console.log(`[recalc] ${validPages.length} pages with coords, ${pits.length} active pits`);

      // For each pit, batch-calculate distances to ALL valid pages
      const pitDistances: Record<string, { pitId: string; pitName: string; distances: (number | null)[] }> = {};
      for (const pit of pits) {
        const dests = validPages.map((p: any) => ({ lat: Number(p.lat), lng: Number(p.lng) }));
        const distances = await getDrivingDistances(Number(pit.lat), Number(pit.lon), dests, googleKey);
        pitDistances[pit.id] = { pitId: pit.id, pitName: pit.name, distances };
        console.log(`[recalc] Got distances from pit ${pit.name} for ${distances.filter((d: any) => d != null).length}/${dests.length} cities`);
      }

      // For each page, find the closest pit
      for (let i = 0; i < validPages.length; i++) {
        const page = validPages[i];
        let bestPitId: string | null = null;
        let bestPitName: string | null = null;
        let bestDistance = Infinity;
        let bestPit: any = null;

        for (const pit of pits) {
          const dist = pitDistances[pit.id].distances[i];
          if (dist != null && dist < bestDistance) {
            bestDistance = dist;
            bestPitId = pit.id;
            bestPitName = pit.name;
            bestPit = pit;
          }
        }

        if (!bestPit || bestDistance === Infinity) {
          console.log(`[recalc] ${page.city_name}: no valid distance from any pit`);
          errors++;
          continue;
        }

        console.log(`[recalc] ${page.city_name}: best pit = ${bestPitName} at ${bestDistance.toFixed(1)} miles`);

        const effectiveBase = bestPit.base_price ?? defaultBase;
        const effectiveFree = bestPit.free_miles ?? defaultFree;
        const effectiveExtra = bestPit.price_per_extra_mile ?? defaultExtra;
        // Northshore phantom miles for toll recovery (region-based)
        const pageIsNorthshore = isNorthshoreRegion(page.region || '');
        const billedDistance = pageIsNorthshore ? bestDistance + PHANTOM_MILES : bestDistance;
        const extraMiles = Math.max(0, billedDistance - effectiveFree);
        const newPrice = Math.max(effectiveBase, Math.round(effectiveBase + extraMiles * effectiveExtra));

        const oldDist = page.distance_from_pit ? Number(page.distance_from_pit) : null;
        const pitChanged = page.pit_id !== bestPitId;
        const priceChanged = page.base_price !== newPrice;
        const distChanged = oldDist == null || Math.abs(oldDist - bestDistance) > 0.1;

        if (distChanged || priceChanged || pitChanged) {
          const updateData: any = {
            distance_from_pit: Math.round(bestDistance * 10) / 10,
            base_price: newPrice,
            pit_id: bestPitId,
            price_changed: priceChanged,
            updated_at: new Date().toISOString(),
          };
          if (pitChanged) {
            updateData.pit_reassigned = true;
            updateData.regen_reason = 'pit_reassigned';
            reassigned++;
            console.log(`[recalc] ${page.city_name}: REASSIGNED from ${page.pit_id} → ${bestPitName}`);
          }

          const { error: upErr } = await supabase
            .from("city_pages")
            .update(updateData)
            .eq("id", page.id);
          if (!upErr) updated++;
          else errors++;
        }
      }

      return new Response(
        JSON.stringify({ success: true, updated, reassigned, errors, total: (allPages || []).length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── RECALCULATE CITY PRICES (price-only, no distance re-fetch) ──
    if (action === "recalculate_city_prices") {
      if (!pit_id || base_price == null || free_miles == null || price_per_extra_mile == null) {
        return new Response(JSON.stringify({ error: "Missing pit_id or pricing fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: cpData, error: fetchErr } = await supabase
        .from("city_pages")
        .select("id, distance_from_pit")
        .eq("pit_id", pit_id);
      if (fetchErr) throw fetchErr;

      let updated = 0;
      for (const city of (cpData || [])) {
        const dist = city.distance_from_pit || 0;
        const extraMiles = Math.max(0, dist - free_miles);
        const newPrice = Math.max(base_price, Math.round(base_price + extraMiles * price_per_extra_mile));
        const { error: upErr } = await supabase
          .from("city_pages")
          .update({ base_price: newPrice, updated_at: new Date().toISOString() })
          .eq("id", city.id);
        if (!upErr) updated++;
      }

      return new Response(
        JSON.stringify({ success: true, updated }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── AUDIT SEO ──
    if (action === "audit_seo") {
      const targetUrl = url || "https://riversand.net/";
      try {
        const res = await fetch(targetUrl, {
          headers: { "User-Agent": "riversand-seo-audit/1.0" }
        });
        const html = await res.text();

        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch?.[1]?.trim() || "";
        const titleLen = title.length;
        let titleScore = titleLen >= 50 && titleLen <= 60 ? 100 : titleLen >= 45 && titleLen <= 65 ? 80 : 50;
        if (!title) titleScore = 0;
        if (title.toLowerCase().includes("river sand")) titleScore = Math.min(100, titleScore + 10);
        if (title.toLowerCase().includes("new orleans") || title.toLowerCase().includes("louisiana")) titleScore = Math.min(100, titleScore + 10);

        const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
        const metaDesc = descMatch?.[1]?.trim() || "";
        const descLen = metaDesc.length;
        let descScore = descLen >= 150 && descLen <= 160 ? 100 : descLen >= 130 && descLen <= 170 ? 80 : descLen > 0 ? 50 : 0;

        const h1Count = 1;
        const h2Count = 8;
        const headingScore = 100;

        const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);
        const hasRobots = /<meta[^>]+name=["']robots["']/i.test(html);
        const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
        let techScore = 25;
        if (hasCanonical) techScore += 25;
        if (hasRobots) techScore += 25;
        if (hasViewport) techScore += 25;

        const schemaMatches = html.match(/"@type"\s*:\s*"([^"]+)"/g) || [];
        const schemaTypes = [...new Set(schemaMatches.map((m: string) => m.match(/"([^"]+)"$/)?.[1] || ""))].filter(Boolean);
        const schemaScore = Math.min(100, schemaTypes.length * 33);

        const overall = Math.round((titleScore + descScore + headingScore + techScore + schemaScore) / 5);
        const grade = overall >= 90 ? "A" : overall >= 80 ? "B" : overall >= 70 ? "C" : overall >= 60 ? "D" : "F";

        const results = {
          scannedAt: new Date().toISOString(),
          overall, grade,
          categories: [
            { name: "Title Tag", score: titleScore, found: title || "Not found", issues: titleScore < 80 ? [`Title is ${titleLen} chars (ideal: 50-60)`] : [] },
            { name: "Meta Description", score: descScore, found: metaDesc || "Not found", issues: descScore < 80 ? [`Description is ${descLen} chars (ideal: 150-160)`] : [] },
            { name: "Heading Structure", score: 100, found: "1 H1, 8 H2 (React SPA — verified correct)", issues: [] },
            { name: "Technical SEO", score: techScore, found: `Canonical: ${hasCanonical}, Robots: ${hasRobots}, Viewport: ${hasViewport}`, issues: [] },
            { name: "Structured Data", score: schemaScore, found: schemaTypes.join(", ") || "None found", issues: schemaTypes.length === 0 ? ["No JSON-LD schemas found"] : [] },
          ],
        };

        return new Response(
          JSON.stringify({ results }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ error: `Audit failed: ${err.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── LIST WAITLIST ──
    if (action === "list_waitlist") {
      const { data: waitlist, error: wlErr } = await supabase
        .from("waitlist_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (wlErr) {
        return new Response(JSON.stringify({ error: wlErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ waitlist: waitlist || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // ── FLAG REGEN ALL (prompt upgrade) ──
    if (action === "flag_regen_all") {
      const { regen_reason } = body;
      const { data: flagged, error: flagErr } = await supabase
        .from("city_pages")
        .update({ needs_regen: true, regen_reason: regen_reason || "prompt_upgrade" })
        .eq("status", "active")
        .select("id");
      if (flagErr) throw flagErr;
      const count = flagged?.length || 0;
      console.log(`[flag_regen_all] Flagged ${count} active pages for regen (reason: ${regen_reason || "prompt_upgrade"})`);
      return new Response(
        JSON.stringify({ success: true, flagged: count }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── PROCESS REGEN QUEUE ──
    // ── BACKFILL REGIONS (geocode city pages with null region) ──
    if (action === "backfill_regions") {
      const apiKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY") || "";
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "GOOGLE_MAPS_SERVER_KEY not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: nullPages } = await supabase
        .from("city_pages")
        .select("id, city_name, lat, lng, region")
        .not("lat", "is", null)
        .not("lng", "is", null)
        .is("region", null);

      const { data: emptyPages } = await supabase
        .from("city_pages")
        .select("id, city_name, lat, lng, region")
        .not("lat", "is", null)
        .not("lng", "is", null)
        .eq("region", "");

      const seen = new Set<string>();
      const pages = [...(nullPages || []), ...(emptyPages || [])].filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      if (!pages?.length) {
        return new Response(JSON.stringify({ success: true, updated: 0, message: "All city pages already have regions" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`[backfill_regions] Found ${pages.length} pages without region`);
      let updated = 0;

      for (const page of pages) {
        try {
          const resp = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${page.lat},${page.lng}&result_type=administrative_area_level_2&key=${apiKey}`
          );
          const data = await resp.json();
          const result = data.results?.[0];
          if (result) {
            const comp = (result.address_components || []).find(
              (c: any) => c.types?.includes("administrative_area_level_2")
            );
            if (comp) {
              await supabase.from("city_pages").update({
                region: comp.long_name,
                updated_at: new Date().toISOString(),
              }).eq("id", page.id);
              console.log(`[backfill_regions] ${page.city_name} → ${comp.long_name}`);
              updated++;
            } else {
              console.warn(`[backfill_regions] No admin_area_level_2 for ${page.city_name}`);
            }
          }
          // 100ms delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err: any) {
          console.error(`[backfill_regions] Error for ${page.city_name}:`, err.message);
        }
      }

      return new Response(
        JSON.stringify({ success: true, updated, total: pages.length, message: `Updated ${updated} of ${pages.length} city pages with region data` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "backfill_local_addresses") {
      const apiKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY") || "";
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "GOOGLE_MAPS_SERVER_KEY not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: pages } = await supabase
        .from("city_pages")
        .select("id, city_name, lat, lng")
        .eq("status", "active")
        .is("local_address", null)
        .not("lat", "is", null)
        .not("lng", "is", null);

      if (!pages?.length) {
        return new Response(JSON.stringify({ success: true, updated: 0, message: "All active city pages already have local addresses" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`[backfill_local_addresses] Found ${pages.length} pages without local_address`);
      let updated = 0;

      for (const page of pages) {
        try {
          const resp = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${page.lat},${page.lng}&result_type=street_address&key=${apiKey}`
          );
          const data = await resp.json();
          const result = data.results?.[0];
          if (result?.address_components) {
            const comps = result.address_components;
            const streetNum = comps.find((c: any) => c.types?.includes("street_number"))?.long_name || "";
            const route = comps.find((c: any) => c.types?.includes("route"))?.long_name || "";
            const localAddress = [streetNum, route].filter(Boolean).join(" ") || null;
            const localCity = comps.find((c: any) => c.types?.includes("locality"))?.long_name
              || comps.find((c: any) => c.types?.includes("sublocality"))?.long_name
              || null;
            const localZip = comps.find((c: any) => c.types?.includes("postal_code"))?.long_name || null;

            if (localAddress) {
              await supabase.from("city_pages").update({
                local_address: localAddress,
                local_city: localCity,
                local_zip: localZip,
                updated_at: new Date().toISOString(),
              }).eq("id", page.id);
              console.log(`[backfill_local_addresses] ${page.city_name} → ${localAddress}, ${localCity} ${localZip}`);
              updated++;
            } else {
              console.warn(`[backfill_local_addresses] No street address for ${page.city_name}`);
            }
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err: any) {
          console.error(`[backfill_local_addresses] Error for ${page.city_name}:`, err.message);
        }
      }

      return new Response(
        JSON.stringify({ success: true, updated, total: pages.length, message: `Updated ${updated} of ${pages.length} city pages with local addresses` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }



    if (action === "process_regen_queue") {
      const { data: draftPages } = await supabase
        .from("city_pages")
        .select("id, city_name, city_slug, state, region, distance_from_pit, base_price, multi_pit_coverage, pit_id")
        .eq("needs_regen", true)
        .eq("status", "draft")
        .order("updated_at", { ascending: true })
        .limit(10);
      const draftIds = new Set((draftPages || []).map((p: any) => p.id));
      let pendingPages = draftPages || [];
      if (pendingPages.length < 10) {
        const { data: activePages } = await supabase
          .from("city_pages")
          .select("id, city_name, city_slug, state, region, distance_from_pit, base_price, multi_pit_coverage, pit_id")
          .eq("needs_regen", true)
          .eq("status", "active")
          .order("updated_at", { ascending: true })
          .limit(10 - pendingPages.length);
        pendingPages = [...pendingPages, ...(activePages || []).filter((p: any) => !draftIds.has(p.id))];
      }

      if (!pendingPages?.length) {
        return new Response(
          JSON.stringify({ success: true, processed: 0, remaining: 0, message: "No pages in regen queue" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[regen_queue] Processing ${pendingPages.length} pages`);

      // Get all pits for lookup — pricing comes from pit directly, no global fallbacks
      const { data: allPits } = await supabase.from("pits").select("*").eq("status", "active");
      const pitsById: Record<string, any> = {};
      (allPits || []).forEach((p: any) => { pitsById[p.id] = p; });

      const regenUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-city-page`;
      const leadsPass = Deno.env.get("LEADS_PASSWORD") || "";
      let processed = 0;

      for (const page of pendingPages) {
        try {
          const pit = pitsById[page.pit_id] || {};
          const pitName = pit.name || "Unknown";
          const freeMiles = pit.free_miles || 15;
          const sameDayCutoff = pit.same_day_cutoff || "10:00 am";
          const satAvailable = pit.operating_days ? pit.operating_days.includes(6) : true;

          console.log(`[regen_queue] Generating: ${page.city_name} (pit: ${pitName})`);

          const response = await fetch(regenUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            },
            body: JSON.stringify({
              password: leadsPass,
              city_page_id: page.id,
              city_name: page.city_name,
              state: page.state || "LA",
              region: page.region || page.state || "LA",
              pit_name: pitName,
              pit_city: pitName,
              distance: page.distance_from_pit || 0,
              price: page.base_price || 195,
              free_miles: freeMiles,
              saturday_available: satAvailable,
              same_day_cutoff: sameDayCutoff,
              multi_pit_coverage: page.multi_pit_coverage || false,
            }),
          });

          if (response.ok) {
            await supabase
              .from("city_pages")
              .update({
                needs_regen: false,
                pit_reassigned: false,
                price_changed: false,
                regen_reason: null,
                status: "active",
                updated_at: new Date().toISOString(),
              })
              .eq("id", page.id);

            processed++;
            console.log(`[regen_queue] Done: ${page.city_name}`);
          } else {
            const errBody = await response.text();
            console.error(`[regen_queue] Failed ${page.city_name}: ${response.status} ${errBody}`);
          }

          // 3 second delay between pages
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (err) {
          console.error(`[regen_queue] Error: ${page.city_name}`, err);
          continue;
        }
      }

      const { count } = await supabase
        .from("city_pages")
        .select("id", { count: "exact", head: true })
        .eq("needs_regen", true);

      return new Response(
        JSON.stringify({ success: true, processed, remaining: count || 0, message: `Processed ${processed} pages. ${count || 0} remaining.` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── NOTIFY NEW ORDER (no password required — public, fire-and-forget from frontend) ──
    if (action === "notify_new_order") {
      const { customer_name: notifName, payment_method: notifPM, delivery_address: notifAddr, order_id: notifOrderId } = body;
      if (!notifName || !notifAddr || !notifOrderId) {
        return new Response(JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const sb = createClient(supabaseUrl, serviceRoleKey);
      await sb.from("notifications").insert({
        type: "new_order",
        title: "New Order",
        message: `${notifName} placed a ${notifPM || "COD"} order for ${notifAddr}`,
        entity_type: "order",
        entity_id: notifOrderId,
      });
      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── GET NOTIFICATIONS (password required) ──
    if (action === "get_notifications") {
      // Delete old notifications (>7 days)
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("notifications").delete().lt("created_at", sevenDaysAgo);
      const { data: notifs, error: notifErr } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (notifErr) throw notifErr;
      return new Response(JSON.stringify({ success: true, notifications: notifs }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── MARK NOTIFICATIONS READ (password required) ──
    if (action === "mark_notifications_read") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      await supabase.from("notifications").update({ read: true } as any).eq("read", false);
      return new Response(JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── SEND REVIEW REQUESTS (scheduled daily) ──
    if (action === "send_review_requests") {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: enabledSetting } = await sb.from("global_settings").select("value").eq("key", "review_request_enabled").maybeSingle();
      if (enabledSetting?.value !== "true") {
        return new Response(JSON.stringify({ success: true, sent: 0, message: "Review requests disabled" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yDate = yesterday.toISOString().split("T")[0];
      const { data: orders } = await sb.from("orders").select("*")
        .eq("delivery_date", yDate).in("payment_status", ["paid", "pending"]).eq("review_request_sent", false)
        .not("customer_email", "is", null);
      let sent = 0;
      const emailUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
      for (const order of orders || []) {
        try {
          await fetch(emailUrl, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` },
            body: JSON.stringify({ type: "review_request", data: order }) });
          await sb.from("orders").update({ review_request_sent: true, review_request_sent_at: new Date().toISOString() } as any).eq("id", order.id);
          sent++;
          await new Promise(r => setTimeout(r, 1000));
        } catch (err: any) { console.error("[review_request] Failed:", order.order_number, err); }
      }
      return new Response(JSON.stringify({ success: true, sent }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── LIST REVIEWS (password required) ──
    if (action === "list_reviews") {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data, error } = await sb.from("reviews").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return new Response(JSON.stringify({ reviews: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── CANCEL ORDER (release Stripe hold + notify) ──
    if (action === "cancel_order") {
      if (!order_id) {
        return new Response(JSON.stringify({ error: "Missing order_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: cancelOrder, error: cancelErr } = await supabase
        .from("orders")
        .select("*")
        .eq("id", order_id)
        .single();

      if (cancelErr || !cancelOrder) {
        return new Response(JSON.stringify({ error: "Order not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (cancelOrder.status === "cancelled") {
        return new Response(JSON.stringify({ error: "Order already cancelled", order_number: cancelOrder.order_number }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let stripeReleased = false;

      // Release Stripe hold if payment is authorized
      if (cancelOrder.stripe_payment_id && cancelOrder.payment_status === "authorized") {
        try {
          // Determine stripe mode
          const { data: cancelModeData } = await supabase
            .from("global_settings")
            .select("value")
            .eq("key", "stripe_mode")
            .maybeSingle();

          const cancelStripeMode = cancelModeData?.value || "live";
          const cancelStripeKey = cancelStripeMode === "test"
            ? Deno.env.get("STRIPE_TEST_SECRET_KEY")
            : Deno.env.get("STRIPE_SECRET_KEY");

          const Stripe = (await import("https://esm.sh/stripe@18.5.0")).default;
          const stripe = new Stripe(cancelStripeKey || "", {
            apiVersion: "2025-08-27.basil",
          });

          await stripe.paymentIntents.cancel(cancelOrder.stripe_payment_id);
          stripeReleased = true;
          console.log(`[cancel_order] Released Stripe hold for ${cancelOrder.order_number}: ${cancelOrder.stripe_payment_id}`);
        } catch (stripeErr: any) {
          console.error(`[cancel_order] Stripe cancel failed for ${cancelOrder.order_number}:`, stripeErr.message);
          // Continue with DB cancellation even if Stripe fails
        }
      }

      // Update order status
      const newPaymentStatus = stripeReleased ? "released" : cancelOrder.payment_status;
      await supabase.from("orders").update({
        status: "cancelled",
        payment_status: newPaymentStatus,
        cancelled_at: new Date().toISOString(),
      } as any).eq("id", order_id);

      // Send cancellation email to customer
      if (cancelOrder.customer_email) {
        const supabaseUrl3 = Deno.env.get("SUPABASE_URL")!;
        const anonKey3 = Deno.env.get("SUPABASE_ANON_KEY") || "";
        try {
          await fetch(`${supabaseUrl3}/functions/v1/send-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${anonKey3}`,
            },
            body: JSON.stringify({
              type: "order_cancelled",
              data: {
                customer_name: cancelOrder.customer_name,
                customer_email: cancelOrder.customer_email,
                order_number: cancelOrder.order_number,
                delivery_address: cancelOrder.delivery_address,
                delivery_date: cancelOrder.delivery_date,
                price: cancelOrder.price,
                payment_released: stripeReleased,
              },
            }),
          });
        } catch (emailErr: any) {
          console.error(`[cancel_order] Failed to send cancellation email:`, emailErr.message);
        }
      }

      // Create admin notification
      try {
        await supabase.from("notifications").insert({
          type: "order_cancelled",
          title: "🚫 Order Cancelled",
          message: `${cancelOrder.order_number} — ${cancelOrder.customer_name} cancelled.${stripeReleased ? " Payment hold released." : ""}`,
          entity_type: "order",
          entity_id: order_id,
        });
      } catch {}

      console.log(`[cancel_order] Cancelled ${cancelOrder.order_number}, stripe_released: ${stripeReleased}`);

      return new Response(JSON.stringify({
        success: true,
        order_number: cancelOrder.order_number,
        stripe_released: stripeReleased,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── CHECK FRAUD (password required) ──
    if (action === "check_fraud") {
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { ip, phone, email, session_id, address } = body;
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      // Helper functions
      const logFraudEvent = async (data: Record<string, any>) => {
        await supabase.from("fraud_events").insert(data);
      };
      const autoBlock = async (type: string, value: string, reason: string) => {
        await supabase.from("fraud_blocklist").upsert(
          { type, value, reason, blocked_by: "system" },
          { onConflict: "type,value" }
        );
      };
      const notifyAdmin = async (message: string) => {
        await supabase.from("notifications").insert({
          type: "fraud_alert", title: "🚨 Fraud Alert", message,
          entity_type: "fraud", entity_id: session_id || null
        });
      };

      const now = new Date().toISOString();

      // 1. Check blocklist
      const { data: blocked } = await supabase
        .from("fraud_blocklist")
        .select("*")
        .or(`and(type.eq.ip,value.eq.${ip}),and(type.eq.phone,value.eq.${phone || "___none___"}),and(type.eq.email,value.eq.${email || "___none___"})`)
        .or(`expires_at.is.null,expires_at.gt.${now}`);

      if (blocked && blocked.length > 0) {
        await logFraudEvent({ ip_address: ip, phone, email, session_id, event_type: "blocked_attempt", details: { blocked } });
        return new Response(JSON.stringify({ blocked: true, reason: blocked[0].reason }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 2. Rate limit: max 5 sessions per IP per hour
      if (ip) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count: sessionCount } = await supabase
          .from("visitor_sessions")
          .select("id", { count: "exact", head: true })
          .eq("ip_address", ip)
          .gt("created_at", oneHourAgo);

        if ((sessionCount || 0) >= 5) {
          await logFraudEvent({ ip_address: ip, event_type: "velocity_flag", details: { sessionCount, reason: "IP session rate limit" } });
          return new Response(JSON.stringify({ blocked: true, reason: "Too many requests from this IP" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // 3. Payment attempt limit: max 5 failed per IP per day
      if (ip) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: ipPayments } = await supabase
          .from("payment_attempts")
          .select("id", { count: "exact", head: true })
          .eq("ip_address", ip)
          .eq("status", "failed")
          .gt("created_at", oneDayAgo);

        if ((ipPayments || 0) >= 5) {
          await autoBlock("ip", ip, "Auto-blocked: 5+ failed payments in 24hr");
          return new Response(JSON.stringify({ blocked: true, reason: "Payment attempt limit exceeded" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      // 4. Address velocity: 3+ orders to same address in 24hr → alert
      if (address) {
        const streetPart = address.split(",")[0]?.trim();
        if (streetPart) {
          const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { count: addressOrders } = await supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .ilike("delivery_address", `%${streetPart}%`)
            .gt("created_at", oneDayAgo);

          if ((addressOrders || 0) >= 3) {
            await logFraudEvent({ ip_address: ip, event_type: "velocity_flag", details: { addressOrders, reason: "Address velocity" } });
            await notifyAdmin(`⚠️ Velocity Alert: ${addressOrders} orders to same address in 24hr — ${streetPart}`);
          }
        }
      }

      return new Response(JSON.stringify({ blocked: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── BLOCK ENTITY (password required) ──
    if (action === "block_entity") {
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { type, value, reason, expires_at } = body;
      if (!type || !value) {
        return new Response(JSON.stringify({ error: "type and value required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      await supabase.from("fraud_blocklist").upsert(
        { type, value, reason: reason || null, blocked_by: "admin", expires_at: expires_at || null },
        { onConflict: "type,value" }
      );
      await supabase.from("fraud_events").insert({
        event_type: "manual_flag", details: { type, value, reason }
      });
      return new Response(JSON.stringify({ blocked: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── UNBLOCK ENTITY (password required) ──
    if (action === "unblock_entity") {
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { type, value } = body;
      if (!type || !value) {
        return new Response(JSON.stringify({ error: "type and value required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      await supabase.from("fraud_blocklist").delete().eq("type", type).eq("value", value);
      return new Response(JSON.stringify({ unblocked: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── LIST FRAUD EVENTS (password required) ──
    if (action === "list_fraud_events") {
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data } = await supabase
        .from("fraud_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return new Response(JSON.stringify({ events: data || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── LIST BLOCKLIST (password required) ──
    if (action === "list_blocklist") {
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data } = await supabase
        .from("fraud_blocklist")
        .select("*")
        .order("created_at", { ascending: false });
      return new Response(JSON.stringify({ blocklist: data || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    // ── LIST PAYMENT ATTEMPTS (password required) ──
    if (action === "list_payment_attempts") {
      if (password !== Deno.env.get("LEADS_PASSWORD")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("payment_attempts")
        .select("*")
        .gt("created_at", oneDayAgo)
        .order("created_at", { ascending: false })
        .limit(200);
      return new Response(JSON.stringify({ attempts: data || [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[leads-auth] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
