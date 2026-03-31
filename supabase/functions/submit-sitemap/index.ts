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

  // 1. Google — ping via Search Console sitemap API
  try {
    const googleUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;
    const res = await fetch(googleUrl);
    results.google = `${res.status} ${res.statusText}`;
  } catch (e) {
    results.google = `error: ${e.message}`;
  }

  // 2. Bing — IndexNow / ping
  try {
    const bingUrl = `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;
    const res = await fetch(bingUrl);
    results.bing = `${res.status} ${res.statusText}`;
  } catch (e) {
    results.bing = `error: ${e.message}`;
  }

  // 3. IndexNow (covers Bing, Yandex, Seznam, Naver)
  try {
    const indexNowUrl = `https://api.indexnow.org/indexnow?url=${encodeURIComponent(SITE_URL)}&urlList=${encodeURIComponent(SITEMAP_URL)}`;
    const res = await fetch(indexNowUrl);
    results.indexnow = `${res.status} ${res.statusText}`;
  } catch (e) {
    results.indexnow = `error: ${e.message}`;
  }

  // 4. Yandex
  try {
    const yandexUrl = `https://webmaster.yandex.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;
    const res = await fetch(yandexUrl);
    results.yandex = `${res.status} ${res.statusText}`;
  } catch (e) {
    results.yandex = `error: ${e.message}`;
  }

  // 5. AI platforms — ping common AI crawl endpoints
  // ChatGPT/OpenAI checks robots.txt and sitemap automatically
  // Perplexity, You.com, and other AI search engines use standard sitemap discovery
  // We ping our own sitemap to warm the cache
  try {
    const res = await fetch(SITEMAP_URL);
    const xml = await res.text();
    const urlCount = (xml.match(/<url>/g) || []).length;
    results.sitemap_warm = `OK - ${urlCount} URLs cached`;
  } catch (e) {
    results.sitemap_warm = `error: ${e.message}`;
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
