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
    const { password, city_page_id, city_name, state, pit_name, distance, price, free_miles, saturday_available } = await req.json();

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

    const systemPrompt = `You are an SEO content writer for River Sand, a same-day bulk river sand delivery company. Write compelling, locally relevant content that helps the page rank for '[city] river sand delivery'. Write in a direct, trustworthy tone. Never use corporate jargon. Always emphasize same-day delivery and local expertise. Content must be unique per city — mention local context, common construction projects in the area, why river sand is used there, and local geography where relevant.`;

    const userPrompt = `Generate a complete city landing page for river sand delivery in ${city_name}, ${state}.

PIT serving this city: ${pit_name}
Distance from dispatch: ${distance} miles
Delivery price: $${price}
Free delivery radius: ${free_miles} miles
Saturday available: ${saturday_available ? "yes" : "no"}

Generate:
1. meta_title (under 60 chars): Format: 'River Sand Delivery ${city_name} ${state} | Same-Day | $${price}'
2. meta_description (under 160 chars): Mention same-day, price, city, state, and call to action.
3. h1_text: Format: 'Same-Day River Sand Delivery in ${city_name}, ${state}'
4. page_content (HTML): Include these sections:
   - Hero paragraph about river sand delivery in ${city_name}, ${state}
   - Why choose River Sand section
   - Delivery details for ${city_name} area
   - Common uses in ${city_name} (construction, drainage, fill)
   - Delivery schedule and pricing
   - Local context paragraph mentioning ${city_name} specifically
   - FAQ section (3-5 questions specific to ${city_name} delivery)
   Use proper HTML: <h2>, <h3>, <p>, <ul>, <li>
   No inline styles. No placeholder text. All content must be specific to ${city_name}, ${state} — never generic.`;

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
              description: "Return the generated city page content",
              parameters: {
                type: "object",
                properties: {
                  meta_title: { type: "string", description: "Meta title under 60 chars" },
                  meta_description: { type: "string", description: "Meta description under 160 chars" },
                  h1_text: { type: "string", description: "H1 heading text" },
                  content: { type: "string", description: "Full HTML content for the page body" },
                },
                required: ["meta_title", "meta_description", "h1_text", "content"],
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
          content: generated.content,
          content_generated_at: new Date().toISOString(),
        })
        .eq("id", city_page_id);

      if (updateErr) {
        console.error("Failed to update city page:", updateErr);
      }
    }

    return new Response(JSON.stringify({ success: true, generated }), {
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
