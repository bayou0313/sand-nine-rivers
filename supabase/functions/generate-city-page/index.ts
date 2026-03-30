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

    const systemPrompt = `You are a local SEO expert writing city landing page content for a river sand delivery service in Louisiana and the Gulf South. You apply principles from The Art of SEO to maximize local search visibility.

Your content must:
1. Target TRANSACTIONAL local search intent — the reader has already decided they want river sand and is choosing a supplier
2. Include the city name and state naturally in each content section (not forced)
3. Demonstrate LOCAL EXPERTISE — reference real local geography, roads, landmarks, parishes, soil conditions
4. Build E-E-A-T signals — show Experience (we've delivered here), Expertise (we know the terrain), Authoritativeness (we're the local choice), Trustworthiness (transparent pricing)
5. Match the PRIMARY KEYWORD INTENT: "[city name] river sand delivery" and "river sand delivery near me"
6. Include SECONDARY KEYWORDS naturally: bulk sand delivery, same-day sand delivery, fill sand, river sand [parish name]
7. Write for PEOPLE FIRST — content must be genuinely useful to someone planning a delivery in this specific city
8. Never use generic filler — every sentence must be specific to this city, parish, or region
9. Never use phrases like "look no further", "we've got you covered", "your one-stop shop", or similar corporate clichés

You MUST respond with a single JSON object (no markdown fences, no explanation) containing these exact fields:
- meta_title (string, max 60 chars)
- meta_description (string, max 160 chars)
- h1_text (string, max 70 chars, MUST start with "River Sand Delivery in", NO pipe characters)
- hero_intro (string, 2-3 sentences)
- why_choose_intro (string, 1-2 sentences)
- delivery_details (string, 1-2 sentences)
- local_uses (array of exactly 4 strings, each 1 sentence)
- local_expertise (string, 2-3 sentences)
- faq_items (array of exactly 3 objects, each with "question" and "answer" strings)
- schema_service_area (string)`;

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
CONTENT REQUIREMENTS:
- meta_title: Max 60 chars. Must include city name and 'river sand delivery'. Format: "River Sand Delivery in ${city_name}, ${state} | Same-Day | River Sand"
- meta_description: Max 160 chars. Must include city name, same-day delivery${isMultiPit ? ", instant pricing" : `, price ($${price})`}, and payment options (cash or card). Written to maximize click-through from search results.
- h1_text: Max 70 chars. MUST start with "River Sand Delivery in". Format: "River Sand Delivery in ${city_name}, ${state} — Same-Day Service". NO pipe characters (|) — pipes are for meta_title only. Must read as a natural headline, not an SEO tag.
- hero_intro: 2-3 sentences. Opens with city name and a specific local reference (road, landmark, project type common to this area). States the core offer. Ends with a confidence signal. NO generic phrases.
- why_choose_intro: 1-2 sentences. Establishes LOCAL AUTHORITY for this specific parish/area. Reference the parish name, local terrain challenge, or why a local supplier matters here. Demonstrates E-E-A-T.
- delivery_details: ${isMultiPit ? "1-2 sentences. Do NOT mention a specific price or distance — this city is covered by multiple dispatch locations. Emphasize that pricing depends on exact address and direct them to the estimator." : `1-2 sentences. Specific logistics: pit name, exact distance (${distance} miles), the actual road(s) used to reach this city (reference real LA highways like LA-18, US-90, I-10, etc.), delivery price ($${price}). Shows we know the route.`}
- local_uses: Exactly 4 items. Each is 1 sentence describing a SPECIFIC common use case for river sand in THIS city's context. Consider: river proximity (levee work), industrial (fill), residential (drainage, landscaping), agricultural (arena/garden). Make each feel local.
- local_expertise: 2-3 sentences. Demonstrates deep local knowledge: geography (river proximity, elevation, flood zone characteristics), soil conditions (silty, clay-heavy, etc.), specific challenges projects face in this area.
- faq_items: Exactly 3 FAQ items. Each with "question" and "answer" fields:
  1. City-specific question about delivery schedule or availability — answer mentions city name
  2. ${isMultiPit ? "City-specific question about pricing — answer says pricing varies by location and directs to the estimator, do NOT mention a specific dollar amount" : `City-specific question about price or distance — answer mentions exact price ($${price}), exact distance (${distance} miles)`}
  3. Local use-case question specific to this city's geography — confident, specific answer
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
    const generated = JSON.parse(toolCall.function.arguments);

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

      const { error: updateErr } = await supabase
        .from("city_pages")
        .update({
          meta_title: generated.meta_title,
          meta_description: generated.meta_description,
          h1_text: generated.h1_text,
          hero_intro: generated.hero_intro || null,
          why_choose_intro: generated.why_choose_intro || null,
          delivery_details: generated.delivery_details || null,
          local_uses: localUsesHtml ? `<ul>${localUsesHtml}</ul>` : null,
          local_expertise: generated.local_expertise || null,
          faq_items: generated.faq_items || null,
          content: fullContent,
          prompt_version: "2.0",
          pit_reassigned: false,
          price_changed: false,
          regen_reason: null,
          content_generated_at: new Date().toISOString(),
          status: "active",
        })
        .eq("id", city_page_id);

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
