import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: cityPages, error } = await supabase
      .from("city_pages")
      .select("city_slug, updated_at")
      .eq("status", "active")
      .order("city_name");

    if (error) {
      console.error("Failed to fetch city pages:", error);
    }

    const baseUrl = "https://riversand.net";
    const now = new Date().toISOString().split("T")[0];

    let urls = `
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <lastmod>${now}</lastmod>
  </url>
  <url>
    <loc>${baseUrl}/order</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
    <lastmod>${now}</lastmod>
  </url>`;

    for (const page of cityPages || []) {
      const lastmod = page.updated_at
        ? page.updated_at.split("T")[0]
        : now;
      urls += `
  <url>
    <loc>${baseUrl}/${page.city_slug}/river-sand-delivery</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <lastmod>${lastmod}</lastmod>
  </url>`;
    }

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

    return new Response(sitemap, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: any) {
    console.error("Sitemap error:", err);
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://riversand.net/</loc>
    <priority>1.0</priority>
  </url>
</urlset>`, {
      headers: { "Content-Type": "application/xml" },
    });
  }
});
