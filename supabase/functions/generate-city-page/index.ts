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
    const { password, city_page_id, city_name, state, region, pit_name, pit_city, distance, price, free_miles, saturday_available, same_day_cutoff } = await req.json();

    const leadsPassword = Deno.env.get("LEADS_PASSWORD");
    if (!leadsPassword || password !== leadsPassword) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
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
9. Never use phrases like "look no further", "we've got you covered", "your one-stop shop", or similar corporate clichés`;

    const effectiveRegion = region || state;
    const effectiveCutoff = same_day_cutoff || "12:00 PM";

    const userPrompt = `Generate structured local SEO content for this city page. Return ONLY the structured tool call — no markdown, no explanation.

CITY DATA:
- City: ${city_name}
- State: ${state} (Louisiana = uses "Parish" not "County")
- Parish/County: ${effectiveRegion}
- Distance from pit: ${distance} miles
- Delivery price: $${price}
- PIT name: ${pit_name}
- PIT location city: ${pit_city || pit_name}
- Operating days: Monday through Saturday
- Same-day cutoff: ${effectiveCutoff}
- Free delivery radius: ${free_miles} miles
- Saturday available: ${saturday_available ? "yes" : "no"}

CONTENT REQUIREMENTS:
- meta_title: Max 60 chars. Must include city name and 'river sand delivery'. Format: "River Sand Delivery in ${city_name}, ${state} | Same-Day | River Sand"
- meta_description: Max 160 chars. Must include city name, same-day delivery, price ($${price}), and payment options (cash or card). Written to maximize click-through from search results.
- h1_text: Max 70 chars. Primary keyword first. Must be transactional, not informational. City name required.
- hero_intro: 2-3 sentences. Opens with city name and a specific local reference (road, landmark, project type common to this area). States the core offer. Ends with a confidence signal. NO generic phrases.
- why_choose_intro: 1-2 sentences. Establishes LOCAL AUTHORITY for this specific parish/area. Reference the parish name, local terrain challenge, or why a local supplier matters here. Demonstrates E-E-A-T.
- delivery_details: 1-2 sentences. Specific logistics: pit name, exact distance (${distance} miles), the actual road(s) used to reach this city (reference real LA highways like LA-18, US-90, I-10, etc.), delivery price ($${price}). Shows we know the route.
- local_uses: Exactly 4 items. Each is 1 sentence describing a SPECIFIC common use case for river sand in THIS city's context. Consider: river proximity (levee work), industrial (fill), residential (drainage, landscaping), agricultural (arena/garden). Make each feel local.
- local_expertise: 2-3 sentences. Demonstrates deep local knowledge: geography (river proximity, elevation, flood zone characteristics), soil conditions (silty, clay-heavy, etc.), specific challenges projects face in this area.
- faq_items: Exactly 3 FAQ items. Each with "question" and "answer" fields:
  1. City-specific question about delivery schedule or availability — answer mentions city name
  2. City-specific question about price or distance — answer mentions exact price ($${price}), exact distance (${distance} miles)
  3. Local use-case question specific to this city's geography — confident, specific answer
- schema_service_area: City name formatted for schema: "${city_name}, ${state}"`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_city_page_content",
              description: "Return the generated city page content with local SEO optimization",
              parameters: {
                type: "object",
                properties: {
                  meta_title: { type: "string", description: "Meta title under 60 chars with city name and 'river sand delivery'" },
                  meta_description: { type: "string", description: "Meta description under 160 chars with city, price, same-day" },
                  h1_text: { type: "string", description: "H1 heading, max 70 chars. MUST start with 'River Sand Delivery in'. Format: 'River Sand Delivery in [City], [State] — Same-Day Service'. NO pipe characters (|). Must read as a natural headline." },
                  hero_intro: { type: "string", description: "2-3 sentence hero intro with local reference" },
                  why_choose_intro: { type: "string", description: "1-2 sentences establishing local authority and E-E-A-T" },
                  delivery_details: { type: "string", description: "1-2 sentences with exact logistics, roads, distance, price" },
                  local_uses: {
                    type: "array",
                    items: { type: "string" },
                    description: "Exactly 4 local use cases, each 1 sentence"
                  },
                  local_expertise: { type: "string", description: "2-3 sentences showing deep local knowledge" },
                  faq_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string" },
                        answer: { type: "string" }
                      },
                      required: ["question", "answer"],
                      additionalProperties: false
                    },
                    description: "Exactly 3 city-specific FAQ items"
                  },
                  schema_service_area: { type: "string", description: "City, State for schema areaServed" }
                },
                required: ["meta_title", "meta_description", "h1_text", "hero_intro", "why_choose_intro", "delivery_details", "local_uses", "local_expertise", "faq_items", "schema_service_area"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_city_page_content" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Add funds in Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response:", JSON.stringify(result));
      return new Response(JSON.stringify({ error: "AI did not return structured content" }), {
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
