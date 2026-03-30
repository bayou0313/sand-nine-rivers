import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Haversine fallback (miles) — used only as pre-filter
const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Get driving distances from one origin to multiple destinations using Google Distance Matrix API.
 * Returns array of distances in miles (null if route not found).
 * Batches in groups of 25 destinations per API call.
 */
async function getDrivingDistances(
  originLat: number, originLon: number,
  destinations: { lat: number; lng: number }[],
  apiKey: string
): Promise<(number | null)[]> {
  if (destinations.length === 0) return [];
  const results: (number | null)[] = new Array(destinations.length).fill(null);
  const BATCH = 25; // Distance Matrix max elements per call with 1 origin

  for (let i = 0; i < destinations.length; i += BATCH) {
    const batch = destinations.slice(i, i + BATCH);
    const destsStr = batch.map(d => `${d.lat},${d.lng}`).join("|");
    try {
      const resp = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLon}&destinations=${encodeURIComponent(destsStr)}&units=imperial&key=${apiKey}`
      );
      const data = await resp.json();
      const elements = data.rows?.[0]?.elements || [];
      for (let j = 0; j < elements.length; j++) {
        if (elements[j]?.status === "OK" && elements[j].distance?.value) {
          results[i + j] = elements[j].distance.value / 1609.344; // meters to miles
        }
      }
    } catch (e) {
      console.error("Distance Matrix batch failed:", e);
      // Leave as null — caller will fall back to haversine
    }
  }
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password, action, id, ids, stage, notes, lead_number, order_number, settings, pit, order_id, collected_by, send_email, pit_id, cities, city_page, city_page_id, base_price, free_miles, price_per_extra_mile } = await req.json();

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
          .update({ value: String(value) })
          .eq("key", key);
        if (error) throw error;
      }
      // Return updated settings
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
      };

      if (pit.id) {
        // Update
        const { data, error } = await supabase
          .from("pits").update(pitData).eq("id", pit.id).select().single();
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, pit: data }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Insert
        const { data, error } = await supabase
          .from("pits").insert(pitData).select().single();
        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, pit: data }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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

    // ── LIST ABANDONED SESSIONS ──
    if (action === "list_abandoned") {
      const { data, error } = await supabase
        .from("visitor_sessions")
        .select("*")
        .in("stage", ["started_checkout", "reached_payment"])
        .not("customer_email", "is", null)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return new Response(
        JSON.stringify({ sessions: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── LIST CASH ORDERS ──
    if (action === "list_cash_orders") {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .in("payment_method", ["cash", "check", "cod", "COD"])
          .neq("payment_status", "cancelled")
          .order("delivery_date", { ascending: true })
          .order("created_at", { ascending: false });
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

        // Send confirmation email if requested
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
      const { error } = await supabase
        .from("city_pages")
        .update({
          meta_title: city_page.meta_title,
          meta_description: city_page.meta_description,
          h1_text: city_page.h1_text,
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
      const { error } = await supabase.from("city_pages").delete().eq("id", id);
      if (error) throw error;
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

      // (haversine is now a top-level function used as pre-filter only)

      // Clean city name helper
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

      // Exclusion words — organizations, businesses, POIs
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
        // Exclude if contains organization words
        for (const word of EXCLUDE_WORDS) {
          if (lower.includes(word)) return false;
        }
        // Exclude if more than 4 words
        const words = name.split(/\s+/);
        if (words.length > 4) return false;
        // Exclude if any word is longer than 20 chars
        if (words.some(w => w.length > 20)) return false;
        return true;
      };

      // Valid geocoding result types for real cities/towns
      const VALID_TYPES = ["locality", "sublocality_level_1", "administrative_area_level_3"];

      // ── STRATEGY: Reverse geocode from radial grid points ──
      // Generate sample points at various distances and directions
      const distances = [3, 5, 8, 10, 13, 15, 18, 20, 23, 25, 28, 30].filter(d => d <= maxDist);
      const directions = [0, 45, 90, 135, 180, 225, 270, 315]; // N, NE, E, SE, S, SW, W, NW
      const samplePoints: { lat: number; lng: number }[] = [
        { lat: pitData.lat, lng: pitData.lon }, // center point
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

      // Reverse geocode each point — collect unique cities
      const cityMap = new Map<string, { name: string; state: string; lat: number; lng: number }>();

      // Process in batches of 10 to avoid rate limits
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
            // Only accept results whose primary type is a valid city type
            const types = result.types || [];
            const hasValidType = types.some((t: string) => VALID_TYPES.includes(t));
            if (!hasValidType) continue;

            // Extract city name and state from address_components
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
            cityName = cleanCityName(cityName);
            if (!isValidCityName(cityName)) continue;

            const key = cityName.toLowerCase();
            if (!cityMap.has(key)) {
              const loc = result.geometry?.location;
              if (loc) {
                cityMap.set(key, { name: cityName, state: stateCode, lat: loc.lat, lng: loc.lng });
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

      // Calculate effective pricing
      const { data: gsData } = await supabase.from("global_settings").select("key, value");
      const gs: Record<string, string> = {};
      for (const row of gsData || []) gs[row.key] = row.value;
      const bPrice = pitData.base_price ?? parseFloat(gs.default_base_price || "195");
      const freeMiles = pitData.free_miles ?? parseFloat(gs.default_free_miles || "15");
      const extraPerMile = pitData.price_per_extra_mile ?? parseFloat(gs.default_extra_per_mile || "5");

      // Build final results — use driving distance instead of straight-line
      const discovered: any[] = [];
      const seenSlugs = new Set<string>();

      // First pass: pre-filter cities within haversine range, collect their coords
      const candidateCities: { key: string; city: { name: string; state: string; lat: number; lng: number } }[] = [];
      for (const [key, city] of cityMap) {
        const straightLine = haversine(pitData.lat, pitData.lon, city.lat, city.lng);
        if (straightLine > maxDist * 1.5) continue; // generous pre-filter (driving is ~1.3x straight-line)
        candidateCities.push({ key, city });
      }

      // Get driving distances for all candidates in one batch
      const drivingDists = await getDrivingDistances(
        pitData.lat, pitData.lon,
        candidateCities.map(c => ({ lat: c.city.lat, lng: c.city.lng })),
        apiKey
      );

      for (let idx = 0; idx < candidateCities.length; idx++) {
        const { city } = candidateCities[idx];
        const distance = drivingDists[idx] ?? haversine(pitData.lat, pitData.lon, city.lat, city.lng);
        if (distance > maxDist) continue;

        let slug = city.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

        // Handle duplicate slug from different states
        if (seenSlugs.has(slug) || (existingSlugs.has(slug) && existingSlugs.get(slug).pit_id !== pit_id)) {
          slug = `${slug}-${(city.state || "us").toLowerCase()}`;
        }
        if (seenSlugs.has(slug)) continue;
        seenSlugs.add(slug);

        const extra = distance > freeMiles ? (distance - freeMiles) * extraPerMile : 0;
        const price = bPrice + extra;
        const existing = existingSlugs.get(slug);

        discovered.push({
          city_name: city.name,
          city_slug: slug,
          state: city.state || "US",
          lat: city.lat,
          lng: city.lng,
          distance: Math.round(distance * 10) / 10,
          price: Math.round(price * 100) / 100,
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
      if (!cities || !Array.isArray(cities) || !pit_id) {
        return new Response(JSON.stringify({ error: "Missing cities array or pit_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Get PIT details for AI generation
      const { data: pitForGen } = await supabase.from("pits").select("*").eq("id", pit_id).single();
      const { data: gsForGen } = await supabase.from("global_settings").select("key, value");
      const gsMap: Record<string, string> = {};
      for (const row of gsForGen || []) gsMap[row.key] = row.value;

      const pitFreeMiles = pitForGen?.free_miles ?? parseFloat(gsMap.default_free_miles || "15");
      const pitBasePrice = pitForGen?.base_price ?? parseFloat(gsMap.default_base_price || "195");
      const pitExtraPerMile = pitForGen?.price_per_extra_mile ?? parseFloat(gsMap.default_extra_per_mile || "5");
      const satAvailable = pitForGen?.operating_days ? pitForGen.operating_days.includes(6) : true;
      const leadsPasswordForGen = Deno.env.get("LEADS_PASSWORD")!;

      const created: string[] = [];
      let generated = 0;
      let failed = 0;
      let skipped = 0;
      for (const city of cities) {
        // ── Closest-PIT dedup: check if slug already exists ──
        const { data: existing } = await supabase
          .from("city_pages")
          .select("id, distance_from_pit")
          .eq("city_slug", city.city_slug)
          .maybeSingle();
        if (existing) {
          if (city.distance < (existing.distance_from_pit ?? 999)) {
            // New PIT is closer — update existing page
            const newPrice = Math.max(pitBasePrice, Math.round(pitBasePrice + Math.max(0, city.distance - pitFreeMiles) * pitExtraPerMile));
            await supabase.from("city_pages").update({
              pit_id, distance_from_pit: city.distance, base_price: newPrice,
            }).eq("id", existing.id);
            console.log(`Updated ${city.city_slug} to closer PIT (${city.distance} mi)`);
          } else {
            console.log(`Skipped ${city.city_slug}: existing PIT is closer (${existing.distance_from_pit} mi)`);
          }
          skipped++;
          continue;
        }

        const { data: inserted, error: insertErr } = await supabase
          .from("city_pages")
          .insert({
            pit_id,
            city_name: city.city_name,
            city_slug: city.city_slug,
            state: city.state || "LA",
            lat: city.lat,
            lng: city.lng,
            distance_from_pit: city.distance,
            base_price: Math.max(pitBasePrice, Math.round(pitBasePrice + Math.max(0, city.distance - pitFreeMiles) * pitExtraPerMile)),
            status: "draft",
          })
          .select()
          .single();

        if (insertErr) {
          console.error("Insert city page error:", insertErr);
          failed++;
          continue;
        }

        // Auto-generate AI content
        try {
          const genResp = await fetch(`${supabaseUrl}/functions/v1/generate-city-page`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              password: leadsPasswordForGen,
              city_page_id: inserted.id,
              city_name: city.city_name,
              state: city.state || "LA",
              pit_name: pitForGen?.name || "Dispatch",
              distance: city.distance,
              price: city.price,
              free_miles: pitFreeMiles,
              saturday_available: satAvailable,
            }),
          });
          if (genResp.ok) {
            await supabase.from("city_pages").update({ status: "active" }).eq("id", inserted.id);
            generated++;
          } else {
            console.error("AI generation failed for", city.city_name, await genResp.text());
            failed++;
          }
        } catch (genErr) {
          console.error("AI generation error for", city.city_name, genErr);
          failed++;
        }

        created.push(inserted.id);
      }

      return new Response(
        JSON.stringify({ success: true, created_ids: created, count: created.length, generated, failed, skipped }),
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

      // (using top-level haversine + getDrivingDistances helpers)

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

      const VALID_TYPES = ["locality", "sublocality_level_1", "administrative_area_level_3"];

      // Get global settings for pricing
      const { data: gsData } = await supabase.from("global_settings").select("key, value");
      const gs: Record<string, string> = {};
      for (const row of gsData || []) gs[row.key] = row.value;

      // Collect all candidates across all PITs
      const allCandidates: Array<{
        city_name: string; city_slug: string; state: string;
        lat: number; lng: number; distance_from_pit: number;
        pit_id: string; pit_name: string; base_price: number;
      }> = [];

      for (const pit of allPits) {
        const maxDist = pit.max_distance || 30;
        const distances = [3, 5, 8, 10, 13, 15, 18, 20, 23, 25, 28, 30].filter(d => d <= maxDist);
        const directions = [0, 45, 90, 135, 180, 225, 270, 315];
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

        // Collect unique cities from reverse geocoding first
        const pitCityMap = new Map<string, { name: string; state: string; lat: number; lng: number }>();
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
              for (const prio of VALID_TYPES) {
                const comp = components.find((c: any) => c.types?.includes(prio));
                if (comp && !cityName) cityName = comp.long_name;
              }
              const stateComp = components.find((c: any) => c.types?.includes("administrative_area_level_1"));
              if (stateComp) stateCode = stateComp.short_name;
              if (!cityName) continue;
              cityName = cleanCityName(cityName);
              if (!isValidCityName(cityName)) continue;
              const loc = result.geometry?.location;
              if (!loc) continue;
              // Pre-filter with haversine (generous 1.5x)
              const straightLine = haversine(pit.lat, pit.lon, loc.lat, loc.lng);
              if (straightLine > maxDist * 1.5) continue;
              const key = cityName.toLowerCase();
              if (!pitCityMap.has(key)) {
                pitCityMap.set(key, { name: cityName, state: stateCode || "LA", lat: loc.lat, lng: loc.lng });
              }
            }
          }
        }

        // Get driving distances for all cities discovered for this PIT
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
          const distance = drivingDists[idx] ?? haversine(pit.lat, pit.lon, city.lat, city.lng);
          if (distance > maxDist) continue;
          const slug = city.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
          const extraMiles = Math.max(0, distance - freeMiles);
          const price = Math.max(bPrice, Math.round(bPrice + extraMiles * extraPerMile));

          allCandidates.push({
            city_name: city.name, city_slug: slug, state: city.state,
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

      // Fetch existing slugs
      const { data: existingPages } = await supabase.from("city_pages").select("city_slug");
      const existingSlugs = new Set(existingPages?.map(p => p.city_slug) ?? []);

      const toCreate = [...bestBySlug.values()].filter(c => !existingSlugs.has(c.city_slug));
      console.log(`[bulk] ${allCandidates.length} total candidates, ${bestBySlug.size} unique, ${toCreate.length} new to create`);

      const leadsPasswordForGen = Deno.env.get("LEADS_PASSWORD")!;
      let created = 0;
      let generated = 0;
      let failed = 0;

      for (const city of toCreate) {
        const { data: inserted, error: insertErr } = await supabase
          .from("city_pages")
          .insert({
            pit_id: city.pit_id, city_name: city.city_name, city_slug: city.city_slug,
            state: city.state, lat: city.lat, lng: city.lng,
            distance_from_pit: city.distance_from_pit, base_price: city.base_price, status: "draft",
          })
          .select().single();
        if (insertErr) { console.error("Insert error:", insertErr); failed++; continue; }
        created++;

        // Generate AI content
        try {
          const pitData = allPits.find(p => p.id === city.pit_id);
          const genResp = await fetch(`${supabaseUrl}/functions/v1/generate-city-page`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({
              password: leadsPasswordForGen, city_page_id: inserted.id,
              city_name: city.city_name, state: city.state,
              pit_name: city.pit_name, distance: city.distance_from_pit,
              price: city.base_price,
              free_miles: pitData?.free_miles ?? parseFloat(gs.default_free_miles || "15"),
              saturday_available: pitData?.operating_days ? pitData.operating_days.includes(6) : true,
            }),
          });
          if (genResp.ok) {
            await supabase.from("city_pages").update({ status: "active" }).eq("id", inserted.id);
            generated++;
          } else { console.error("AI gen failed for", city.city_name); failed++; }
        } catch (genErr) { console.error("AI gen error:", genErr); failed++; }
      }

      return new Response(
        JSON.stringify({ success: true, created, generated, failed, skipped: existingSlugs.size, total_candidates: allCandidates.length, unique_cities: bestBySlug.size }),
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

    // ── RECALCULATE CITY PRICES ──
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
