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

    const userPrompt = `Generate structured local SEO content for this city page. Return ONLY a JSON object — no markdown, no explanation.

CITY DATA:
- City: ${city_name}
- State: ${state} (Louisiana = uses "Parish" not "County")
- Parish/County: ${effectiveRegion}
- Distance from pit: ${distance} miles
- Delivery price: $${price}
- PIT name: ${pit_name}
- PIT location city: ${pit_city || pit_name}
- Multi-PIT coverage: ${isMultiPit ? "TRUE" : "FALSE"}
- Operating days: Monday through Saturday
- Same-day cutoff: ${effectiveCutoff}
- Free delivery radius: ${free_miles} miles
- Saturday available: ${saturday_available ? "yes" : "no"}
${multiPitInstructions}
${city_name.toLowerCase() === "algiers" ? `
IMPORTANT — ALGIERS ROUTING:
Algiers is on the west bank of the Mississippi River within Orleans Parish.
All delivery routes from east bank PITs cross via the Crescent City Connection bridge.
Mention this in delivery_details and local_expertise — it demonstrates genuine
local knowledge and sets accurate expectations.
` : ""}${city_name.toLowerCase() === "new orleans east" ? `
IMPORTANT — NEW ORLEANS EAST ROUTING:
New Orleans East is east of the Industrial Canal, accessed primarily via I-10.
It is significantly further from the CBD than its Orleans Parish designation suggests.
Reference I-10, Chef Menteur Highway, or specific New Orleans East landmarks
(NASA Michoud, Lake Forest Boulevard, Read Boulevard) in local content.
` : ""}
CONTENT REQUIREMENTS:
- meta_title: Max 60 chars. Must include city name and "river sand delivery". ${isMultiPit ? `Format: "River Sand Delivery in ${city_name}, ${state} | Same-Day"` : `Format: "River Sand Delivery in ${city_name}, ${state} | $${price}/Load"`}. Never include the brand name "River Sand" at the end if it pushes past 60 chars.
- meta_description: Max 160 chars. Must be UNIQUE to this city — never reuse the same sentence structure across cities. ${isMultiPit ? `Must include: city name, "same-day", "instant pricing", and "cash or card". Example: "Same-day river sand delivery to ${city_name}, ${state}. Enter your address for instant pricing. Cash or card accepted."` : `Must include: city name, exact price ($${price}), "same-day", and "cash or card". Example: "Same-day river sand delivery to ${city_name}, ${state} — $${price} per load. No minimums. Cash or card. Order before ${effectiveCutoff} for today."`} Vary the opening word and sentence rhythm — do NOT start with "Same-day" on every page. Avoid generic AI filler words like "bustling", "vibrant", "thriving", or vague Louisiana descriptors. Write like a local business, not a travel blog.
- h1_text: Max 70 chars. MUST start with "River Sand Delivery in". Format: "River Sand Delivery in ${city_name}, ${state} — Same-Day Service". NO pipe characters (|) — pipes are for meta_title only. Must read as a natural headline, not an SEO tag.
- hero_intro: ONE sentence. Maximum 120 characters. Must contain "${city_name} river sand delivery" naturally. Lead with a specific local detail — a road, landmark, or project type. Never restate the H1. No period at the end. Example: "Serving Chalmette homeowners along St. Bernard Highway — same-day bulk river sand delivery"
- why_choose_intro: ONE sentence. Maximum 200 characters. Must include the city name, the parish name, and the phrase "river sand" or "river sand delivery". Establishes local authority — reference a specific terrain challenge, drainage issue, or soil condition unique to this parish. No generic claims.
- delivery_details: ${isMultiPit ? "ONE sentence. Maximum 220 characters. Must include the city name. Do NOT mention a specific price or distance. Direct the customer to enter their address for an exact quote." : `ONE sentence. Maximum 220 characters. Must include: city name, the phrase "river sand delivery", pit name, exact distance (${distance} miles), at least one real Louisiana highway (LA-18, US-90, I-10, LA-308, etc.), and delivery price ($${price}). Pack in the specifics — this is conversion copy.`}
- local_uses: Exactly 4 items. Each item is ONE sentence, maximum 100 characters. Each must mention the city name OR a specific local landmark/geography. Cover 4 different use cases from: levee repair, drainage fill, landscaping base, pool fill, foundation backfill, driveway base, arena footing, garden beds. Vary the use cases — no repeats. Must include "river sand" in at least 2 of the 4 items.
- local_expertise: Exactly 2 sentences. Maximum 320 characters total. Must include: city name, parish name, and "river sand" or "bulk sand". First sentence: specific geography (river proximity, elevation, flood zone, levee system). Second sentence: specific soil challenge and why river sand is the solution. No generic Louisiana filler.
- faq_items: Exactly 3 FAQ items. Each with "question" and "answer" fields.
  QUESTION rules: maximum 80 characters, phrased as a natural search query, must include city name and "river sand" in at least 2 of 3 questions.
  ANSWER rules: maximum 160 characters, must be a direct confident answer, must include city name in each answer, include specific data (price, distance, time, or day) wherever possible.
  Question 1: Delivery schedule or same-day availability for ${city_name} — answer must mention same-day cutoff time and days available.
  Question 2: ${isMultiPit ? `Pricing for ${city_name} — answer says pricing varies by exact address and directs to the estimator. Do NOT mention a dollar amount.` : `Price or distance for ${city_name} — answer must include exact price ($${price}) and exact distance (${distance} miles).`}
  Question 3: A local use case specific to ${city_name} geography — answer demonstrates local expertise with a specific detail.
- schema_service_area: City name formatted for schema: "${city_name}, ${state}"`;

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
