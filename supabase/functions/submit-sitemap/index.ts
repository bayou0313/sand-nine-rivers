import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const results: Record<string, string> = {};
  const sitemapUrl = "https://riversand.net/sitemap.xml";

  // 1. Google
  try {
    const res = await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`);
    results.google = `${res.status}`;
    console.log("[sitemap] Submitted to Google");
  } catch (e: any) {
    results.google = `error: ${e.message}`;
  }

  // 2. Bing
  try {
    const res = await fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`);
    results.bing = `${res.status}`;
    console.log("[sitemap] Submitted to Bing");
  } catch (e: any) {
    results.bing = `error: ${e.message}`;
  }

  // 3. IndexNow — notifies Bing, Yandex, Seznam, Naver, Yep
  try {
    const topPages = [
      "https://riversand.net",
      "https://riversand.net/new-orleans/river-sand-delivery",
      "https://riversand.net/metairie/river-sand-delivery",
      "https://riversand.net/kenner/river-sand-delivery",
      "https://riversand.net/chalmette/river-sand-delivery",
      "https://riversand.net/harvey/river-sand-delivery",
      "https://riversand.net/gretna/river-sand-delivery",
      "https://riversand.net/belle-chasse/river-sand-delivery",
      "https://riversand.net/destrehan/river-sand-delivery",
      "https://riversand.net/hahnville/river-sand-delivery",
    ];

    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: "riversand.net",
        key: "riversand-indexnow-key",
        keyLocation: "https://riversand.net/riversand-indexnow-key.txt",
        urlList: topPages,
      }),
    });
    results.indexnow = `${res.status}`;
    console.log("[sitemap] Submitted to IndexNow");
  } catch (e: any) {
    results.indexnow = `error: ${e.message}`;
  }

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
