import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password, city_page_id, city_name, state, region, pit_name, pit_city, distance, price, free_miles, saturday_available, same_day_cutoff, multi_pit_coverage } = await req.json();

    const leadsPassword = Deno.env.get("LEADS_PASSWORD");
    if (!leadsPassword || password !== leadsPassword) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are Lander, the dedicated landing page improvement and local SEO agent for riversand.net — a same-day bulk river sand delivery service operating in the Gulf South region of Louisiana.

ABOUT RIVERSAND.NET:
- Same-day bulk river sand delivery platform serving Gulf South Louisiana
- Multiple sand pit locations (PITs) each with independent pricing based on distance
- Pricing: base price + per-mile surcharge beyond free miles, always rounded to nearest dollar
- Payment: cash on delivery (COD) or Stripe card payment
- Operating days: Monday through Saturday
- Service area: Greater New Orleans metro, expanding to Southwest Louisiana
- Louisiana uses parishes, not counties

YOUR ROLE FOR CITY PAGE GENERATION:
You write hyper-local, conversion-optimized city landing page content for each delivery area. Your content must rank in local search results and convert visitors into delivery orders.

CONTENT PRINCIPLES — strictly enforced:
1. Target TRANSACTIONAL local search intent — the reader has decided they want river sand and is choosing a supplier
2. Include city name, state, and parish naturally throughout — never forced
3. Demonstrate LOCAL EXPERTISE — reference real local geography, roads, landmarks, parishes, soil conditions specific to Louisiana
4. Build E-E-A-T signals from The Art of SEO (4th Edition):
   - Experience: we have delivered here before
   - Expertise: we know the terrain, routes, and soil conditions
   - Authoritativeness: we are the local choice, not a national broker
   - Trustworthiness: transparent pricing, no hidden fees, real drivers
5. PRIMARY KEYWORD: "[city name] river sand delivery" and "river sand delivery near me"
6. SECONDARY KEYWORDS: bulk sand delivery, same-day sand delivery, fill sand, river sand [parish name]
7. Write for people first — every sentence must be specific to this exact city
8. Louisiana geography awareness: proximity to Mississippi River means high water tables, silty soil, levee considerations, flood zone awareness

WRITING STYLE — strictly enforced:
- NO em dashes (—) used decoratively — only where grammatically essential
- NO pipe characters (|) in h1_text ever
- NO generic filler phrases: "look no further", "we've got you covered", "one-stop shop", "seamless", "leverage", "utilize", "in today's world"
- USE contractions naturally: we're, you'll, it's, don't, can't
- VARY sentence length — mix short punchy sentences with longer detailed ones
- START sentences differently — never two consecutive sentences beginning the same way
- WRITE like a local business owner who has personally driven a truck to this city many times
- hero_intro should sound like someone who knows the street names and shortcuts
- local_expertise should read like hard-won local knowledge, not encyclopedia text
- FAQ answers should be conversational and direct, not formal

OUTPUT FORMAT:
Always return valid JSON only — no markdown, no preamble, no explanation, no code fences. Just the raw JSON object.`;
    const effectiveRegion = region || state;
    const effectiveCutoff = same_day_cutoff || "12:00 PM";

    const isMultiPit = multi_pit_coverage === true;

    const multiPitInstructions = isMultiPit ? `
IMPORTANT — Multi-PIT Coverage is TRUE for this city:
- "delivery_details" must NOT mention a specific price or distance. Instead write: "${city_name} is served by multiple River Sand dispatch locations. Your exact delivery price depends on your specific address — enter it above for an instant quote."
- FAQ price answer must NOT mention a specific dollar amount. Instead write: "Delivery pricing to ${city_name} varies by location within the city. Enter your address in the estimator above and you'll see your exact price instantly — no phone call needed."
- All other fields (hero_intro, why_choose_intro, local_uses, local_expertise) write normally with local knowledge.
- meta_description should NOT include a specific price — instead emphasize "instant pricing" and "same-day delivery".` : "";

    const userPrompt = `Generate a complete city landing page for river sand delivery in ${city_name}, ${state}. Return ONLY a JSON object — no markdown, no explanation.

INPUTS:
- City: ${city_name}, ${state}
- Parish/Region: ${effectiveRegion}
- Distance from pit: ${distance} miles
- Base delivery price: $${price}/load
- Free delivery zone: ${free_miles} miles
- Saturday delivery: ${saturday_available ? "Yes" : "No"}
- Same-day cutoff: ${effectiveCutoff}
- Served by: ${pit_name} (${pit_city || pit_name})
- Multi-PIT coverage: ${isMultiPit ? "TRUE" : "FALSE"}
${multiPitInstructions}
${city_name.toLowerCase() === "algiers" ? `
IMPORTANT — ALGIERS ROUTING:
Algiers is on the west bank of the Mississippi River within Orleans Parish.
All delivery routes from east bank PITs cross via the Crescent City Connection bridge.
Mention this in delivery_details and local_expertise.
` : ""}${city_name.toLowerCase() === "new orleans east" ? `
IMPORTANT — NEW ORLEANS EAST ROUTING:
New Orleans East is east of the Industrial Canal, accessed primarily via I-10.
Reference I-10, Chef Menteur Highway, or landmarks (NASA Michoud, Lake Forest Boulevard).
` : ""}
STRICT REQUIREMENTS — every field must be 100% unique to ${city_name}. Never use generic New Orleans or Louisiana boilerplate.

FIELD SPECIFICATIONS:

meta_title: ${isMultiPit ? `"River Sand Delivery in ${city_name}, ${state} | Same-Day"` : `"River Sand Delivery in ${city_name}, ${state} | Same-Day from $${price}"`}. Max 65 characters. Include city name and price.

meta_description: Must include ALL of these: 1) City name "${city_name}", 2) ${isMultiPit ? '"instant pricing"' : `Exact price "$${price}"`}, 3) Same-day availability, 4) "Cash or card accepted". Under 155 characters. Vary the opening word — do NOT start with "Same-day" every time. No AI filler words (bustling, vibrant, thriving).

h1_text: "Same-Day River Sand Delivery in ${city_name}, ${state}". Must include city name. No pipe characters.

hero_intro: 3 sentences. Sentence 1: Reference a specific street, highway, or landmark in ${city_name}. Sentence 2: ${isMultiPit ? "Mention instant pricing and same-day delivery." : `Mention the delivery price ($${price}) and distance (${distance} miles).`} Sentence 3: Call to action with phone number 1-855-GOT-WAYS. Max 300 characters total.

why_choose_intro: 2-3 sentences specific to ${city_name} customers — mention local drainage issues, soil type, or common construction projects in the area. Include the parish name "${effectiveRegion}". Never mention pit locations or pit addresses.

delivery_details: ${isMultiPit ? `ONE sentence, max 220 chars. Do NOT mention a specific price or distance. Direct the customer to enter their address for an exact quote.` : `ONE sentence, max 220 chars. Must include: city name, "river sand delivery", exact distance (${distance} miles), at least one real Louisiana highway, and price ($${price}).`}

local_uses: Exactly 4 items. Each item is ONE sentence, max 100 characters. Each must mention ${city_name} OR a specific local landmark/geography. Cover 4 different use cases (levee repair, drainage fill, landscaping, pool fill, foundation backfill, driveway base, arena footing, garden beds). Include "river sand" in at least 2.

local_expertise: 2-3 sentences about why river sand specifically matters in ${city_name}. Reference local soil conditions, flood history, or construction patterns. Include parish name "${effectiveRegion}". Max 320 chars total.

faq_items: Exactly 3 FAQ items with "question" and "answer" fields.
  Q1: Delivery schedule/same-day availability for ${city_name}. Answer must mention cutoff time and days.
  Q2: ${isMultiPit ? `Pricing for ${city_name} — answer says pricing varies, directs to estimator. No dollar amount.` : `Price for ${city_name} — answer must include exact price ($${price}) and distance (${distance} miles).`}
  Q3: A local use case specific to ${city_name} geography. Answer demonstrates local expertise.
  Questions must be phrased as natural search queries. Include "river sand" and "${city_name}" in at least 2 questions.

schema_service_area: "${city_name}, ${state}"

CRITICAL RULES:
- Never mention Bridge City, Hahnville, Chalmette, or any pit location by name
- Every page must read as if written specifically for a ${city_name} resident
- ${isMultiPit ? "Do not mention specific prices — direct to estimator" : `Include the price $${price} at least 3 times across all content`}
- Always mention 1-855-GOT-WAYS at least once
- Reference the parish "${effectiveRegion}" by name naturally`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
      model: "claude-sonnet-4-5",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const rawText = (result.content || [])
      .filter((block: any) => block.type === "text")
      .map((block: any) => block.text)
      .join("");

    const cleanText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let generated: any;
    try {
      generated = JSON.parse(cleanText);
    } catch (parseErr) {
      console.error("Failed to parse AI JSON:", cleanText);
      return new Response(JSON.stringify({ error: "AI did not return valid JSON" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the full HTML content from structured sections
    const localUsesHtml = (generated.local_uses || [])
      .map((item: string) => `<li>${item}</li>`)
      .join("\n      ");

    const faqHtml = (generated.faq_items || [])
      .map((faq: { question: string; answer: string }) =>
        `<div class="faq-item">\n        <h3>${faq.question}</h3>\n        <p>${faq.answer}</p>\n      </div>`
      )
      .join("\n      ");

    const fullContent = `<div class="city-page-content">
      <p class="hero-intro">${generated.hero_intro || ""}</p>

      <h2>Why Choose River Sand in ${city_name}</h2>
      <p>${generated.why_choose_intro || ""}</p>

      <h2>Delivery Details for ${city_name}</h2>
      <p>${generated.delivery_details || ""}</p>

      <h2>Common Uses for River Sand in ${city_name}</h2>
      <ul>
      ${localUsesHtml}
      </ul>

      <h2>Local Expertise</h2>
      <p>${generated.local_expertise || ""}</p>

      <h2>Frequently Asked Questions — ${city_name} River Sand Delivery</h2>
      ${faqHtml}
    </div>`;

    // Update city_pages record if city_page_id provided
    if (city_page_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const generatedAt = new Date().toISOString();

      // Reverse geocode the city's lat/lng for local address schema data
      let localAddress: string | null = null;
      let localCity: string | null = null;
      let localZip: string | null = null;

      try {
        const { data: pageRow } = await supabase
          .from("city_pages")
          .select("lat, lng")
          .eq("id", city_page_id)
          .single();

        if (pageRow?.lat && pageRow?.lng) {
          const geoKey = Deno.env.get("GOOGLE_MAPS_SERVER_KEY") || "";
          if (geoKey) {
            const geoResp = await fetch(
              `https://maps.googleapis.com/maps/api/geocode/json?latlng=${pageRow.lat},${pageRow.lng}&result_type=street_address&key=${geoKey}`
            );
            const geoData = await geoResp.json();
            const geoResult = geoData.results?.[0];
            if (geoResult?.address_components) {
              const comps = geoResult.address_components;
              const streetNum = comps.find((c: any) => c.types?.includes("street_number"))?.long_name || "";
              const route = comps.find((c: any) => c.types?.includes("route"))?.long_name || "";
              localAddress = [streetNum, route].filter(Boolean).join(" ") || null;
              localCity = comps.find((c: any) => c.types?.includes("locality"))?.long_name
                || comps.find((c: any) => c.types?.includes("sublocality"))?.long_name
                || null;
              localZip = comps.find((c: any) => c.types?.includes("postal_code"))?.long_name || null;
              console.log(`[generate-city-page] Geocoded ${city_name}: ${localAddress}, ${localCity} ${localZip}`);
            }
          }
        }
      } catch (geoErr: any) {
        console.error(`[generate-city-page] Geocoding error for ${city_name}:`, geoErr.message);
      }

      const baseUpdate = {
        meta_title: generated.meta_title,
        meta_description: generated.meta_description,
        h1_text: generated.h1_text,
        content: fullContent,
        prompt_version: "3.1",
        pit_reassigned: false,
        price_changed: false,
        regen_reason: null,
        content_generated_at: generatedAt,
        status: "active",
      };

      const structuredUpdate = {
        ...baseUpdate,
        hero_intro: generated.hero_intro || null,
        why_choose_intro: generated.why_choose_intro || null,
        delivery_details: generated.delivery_details || null,
        local_uses: localUsesHtml ? `<ul>${localUsesHtml}</ul>` : null,
        local_expertise: generated.local_expertise || null,
        faq_items: generated.faq_items || null,
        local_address: localAddress,
        local_city: localCity,
        local_zip: localZip,
      };

      let { error: updateErr } = await supabase
        .from("city_pages")
        .update(structuredUpdate)
        .eq("id", city_page_id);

      if (updateErr?.code === "PGRST204") {
        ({ error: updateErr } = await supabase
          .from("city_pages")
          .update(baseUpdate)
          .eq("id", city_page_id));
      }

      if (updateErr) {
        console.error("Failed to update city page:", updateErr);
      }
    }

    return new Response(JSON.stringify({ success: true, generated: { ...generated, content: fullContent, local_uses: localUsesHtml ? `<ul>${localUsesHtml}</ul>` : null } }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[generate-city-page] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
