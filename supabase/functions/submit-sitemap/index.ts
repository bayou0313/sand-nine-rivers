import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITEMAP_URL = "https://lclbexhytmpfxzcztzva.supabase.co/functions/v1/generate-sitemap";
const SITE_URL = "https://riversand.net";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const results: Record<string, string> = {};

  // 1. Google — Search Console ping (legacy but still functional for some)
  try {
    const googleUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;
    const res = await fetch(googleUrl);
    results.google_ping = `${res.status}`;
  } catch (e: any) {
    results.google_ping = `error: ${e.message}`;
  }

  // 2. Bing — Webmaster ping
  try {
    const bingUrl = `https://www.bing.com/webmaster/ping.aspx?siteMap=${encodeURIComponent(SITEMAP_URL)}`;
    const res = await fetch(bingUrl);
    results.bing = `${res.status}`;
  } catch (e: any) {
    results.bing = `error: ${e.message}`;
  }

  // 3. IndexNow (Bing, Yandex, Seznam, Naver, Yep)
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: "riversand.net",
        key: "riversand-indexnow-key",
        urlList: [
          `${SITE_URL}/`,
          `${SITE_URL}/order`,
          `${SITE_URL}/sitemap.xml`,
        ],
      }),
    });
    results.indexnow = `${res.status}`;
  } catch (e: any) {
    results.indexnow = `error: ${e.message}`;
  }

  // 4. Yandex
  try {
    const yandexUrl = `https://webmaster.yandex.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;
    const res = await fetch(yandexUrl);
    results.yandex = `${res.status}`;
  } catch (e: any) {
    results.yandex = `error: ${e.message}`;
  }

  // 5. Warm the sitemap cache and count URLs
  try {
    const res = await fetch(SITEMAP_URL);
    const xml = await res.text();
    const urlCount = (xml.match(/<url>/g) || []).length;
    results.sitemap_urls = `${urlCount}`;
  } catch (e: any) {
    results.sitemap_urls = `error: ${e.message}`;
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
