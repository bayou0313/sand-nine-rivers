import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Fetch all active city pages dynamically
  const { data: cityPages } = await supabase
    .from("city_pages")
    .select("city_slug")
    .eq("status", "active")
    .order("city_slug");

  const siteUrls = [
    "https://riversand.net",
    "https://riversand.net/order",
    ...(cityPages || []).map((p: any) =>
      `https://riversand.net/${p.city_slug}/river-sand-delivery`
    ),
  ];

  const results: Record<string, string> = {};

  // IndexNow — notifies Bing, Yandex, Seznam, Naver, Yep
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: "riversand.net",
        key: "riversand-indexnow-key",
        keyLocation: "https://riversand.net/riversand-indexnow-key.txt",
        urlList: siteUrls,
      }),
    });
    results.indexnow = `${res.status}`;
    await res.text();
    console.log(`[sitemap] IndexNow submitted ${siteUrls.length} URLs`);
  } catch (e: any) {
    results.indexnow = `error: ${e.message}`;
  }

  results.url_count = `${siteUrls.length}`;
  const timestamp = new Date().toISOString();
  console.log(`[submit-sitemap] ${timestamp}`, JSON.stringify(results));

  return new Response(
    JSON.stringify({ submitted_at: timestamp, results }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
