#!/usr/bin/env node
/**
 * Pre-render SEO-rich SPA shells for each active city page.
 * Runs after `npm run build` during GitHub Actions deploy.
 *
 * Each city gets:
 *   <head>  — unique title, meta desc, canonical, OG tags, 3 JSON-LD schemas,
 *             plus all Vite CSS/JS asset tags extracted from dist/index.html
 *   <body>  — empty <div id="root"></div> for React to mount into,
 *             Vite <script> tags, and a <noscript> fallback with key content
 *
 * Result: Google reads rich metadata instantly; React hydrates the full UI.
 */
import { writeFileSync, readFileSync, mkdirSync, copyFileSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lclbexhytmpfxzcztzva.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjbGJleGh5dG1wZnh6Y3p0enZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0ODMxMzMsImV4cCI6MjA5MDA1OTEzM30.w8uMZgeAmAOCe2kQ7u-lM4KVWjkzRgVp5qmKBTJrGQg';
const DIST = join(process.cwd(), 'dist');
const SITE = 'https://riversand.net';

// Legacy city slugs that had a -la suffix — redirect to clean versions
const LEGACY_REDIRECTS = [
  { from: 'chalmette-la', to: 'chalmette' },
  { from: 'bridge-city-la', to: 'bridge-city' },
  { from: 'destrehan-la', to: 'destrehan' },
  { from: 'kenner-la', to: 'kenner' },
  { from: 'luling-la', to: 'luling' },
  { from: 'meraux-la', to: 'meraux' },
  { from: 'metairie-la', to: 'metairie' },
  { from: 'new-orleans-la', to: 'new-orleans' },
];

function buildRedirect(fromSlug, toSlug) {
  const target = `${SITE}/${toSlug}/river-sand-delivery`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Redirecting…</title>
<link rel="canonical" href="${target}">
<meta http-equiv="refresh" content="0; url=${target}">
<script>window.location.replace("${target}");</script>
</head>
<body>
<p>This page has moved. <a href="${target}">Click here</a> if you are not redirected.</p>
</body>
</html>`;
}

async function query(table, params = '') {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?${params}`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );
  if (!res.ok) throw new Error(`Supabase ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

function esc(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Extract CSS <link> and JS <script> tags from dist/index.html
 */
function extractViteAssets(indexHtml) {
  const cssLinks = [];
  const scriptTags = [];

  // Match <link> tags (stylesheets + modulepreload)
  const linkRegex = /<link\s[^>]*(?:rel="stylesheet"|rel="modulepreload")[^>]*\/?>/gi;
  let m;
  while ((m = linkRegex.exec(indexHtml)) !== null) {
    cssLinks.push(m[0]);
  }

  // Match <script> tags
  const scriptRegex = /<script\s[^>]*type="module"[^>]*>[\s\S]*?<\/script>/gi;
  while ((m = scriptRegex.exec(indexHtml)) !== null) {
    scriptTags.push(m[0]);
  }

  return { cssLinks, scriptTags };
}

function buildFaqSchema(faqItems) {
  if (!faqItems || !Array.isArray(faqItems) || faqItems.length === 0) return '';
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((f) => ({
      '@type': 'Question',
      name: f.question || f.q || '',
      acceptedAnswer: { '@type': 'Answer', text: f.answer || f.a || '' },
    })),
  });
}

function buildPage(city, cssLinks, scriptTags) {
  const canonical = `${SITE}/${city.city_slug}/river-sand-delivery`;
  const title = city.meta_title || `River Sand Delivery in ${city.city_name}, ${city.state}`;
  const desc = city.meta_description || `Same-day river sand delivery in ${city.city_name}, ${city.state}. Order online for fast, reliable bulk sand delivery.`;
  const h1 = city.h1_text || `River Sand Delivery in ${city.city_name}, ${city.state} — Same-Day Service`;
  const heroIntro = city.hero_intro || `Same-day bulk river sand delivery to ${city.city_name}, ${city.state}.`;
  const ogImage = 'https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/river-sand-product-new-orleans.jpg';

  // --- Schema: Breadcrumb ---
  const breadcrumbSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'name': `River Sand Delivery in ${city.city_name}`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'River Sand Delivery', item: SITE },
      { '@type': 'ListItem', position: 3, name: city.city_name, item: canonical },
    ],
  });

  // --- Schema: LocalBusiness ---
  const localBusinessSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: `River Sand — ${city.city_name}`,
    url: canonical,
    telephone: '1-855-GOT-WAYS',
    description: desc,
    areaServed: {
      '@type': 'City',
      name: city.city_name,
      containedInPlace: { '@type': 'AdministrativeArea', name: city.region || city.state },
    },
    priceRange: '$$',
    paymentAccepted: 'Cash, Credit Card',
    openingHours: 'Mo-Sa 07:00-17:00',
    address: {
      '@type': 'PostalAddress',
      streetAddress: city.local_address || '',
      addressLocality: city.local_city || city.city_name,
      addressRegion: 'LA',
      postalCode: city.local_zip || '',
      addressCountry: 'US',
    },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'River Sand Delivery Services',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: `River Sand Delivery in ${city.city_name}`,
            description: `Same-day bulk river sand delivery to ${city.city_name}, ${city.state}`,
            areaServed: city.city_name,
            ...(city.base_price ? { price: city.base_price, priceCurrency: 'USD' } : {}),
          },
        },
      ],
    },
  });

  // --- Schema: FAQ ---
  const faqSchema = buildFaqSchema(city.faq_items);

  // --- Noscript content ---
  const priceText = city.base_price
    ? `Starting at $${Number(city.base_price).toFixed(0)} per 9 cu yd load.`
    : 'Enter your address for an instant delivery price.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:type" content="website">
<meta property="og:image" content="${ogImage}">
<meta name="theme-color" content="#0D2137">
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="preconnect" href="https://lclbexhytmpfxzcztzva.supabase.co">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<script type="application/ld+json">${breadcrumbSchema}</script>
<script type="application/ld+json">${localBusinessSchema}</script>
${faqSchema ? `<script type="application/ld+json">${faqSchema}</script>` : ''}
${cssLinks.join('\n')}
</head>
<body>
<div id="root"></div>
<noscript>
<h1>${esc(h1)}</h1>
<p>${esc(heroIntro)}</p>
<p>${esc(priceText)}</p>
<p>River Sand provides same-day bulk river sand delivery to ${esc(city.city_name)}, ${esc(city.state)} and surrounding areas. Call 1-855-GOT-WAYS or visit <a href="${SITE}">riversand.net</a> for an instant quote.</p>
</noscript>
${scriptTags.join('\n')}
</body>
</html>`;
}

async function main() {
  // 1. Extract Vite assets from the built index.html
  console.log('Extracting Vite assets from dist/index.html…');
  const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf-8');
  const { cssLinks, scriptTags } = extractViteAssets(indexHtml);
  console.log(`  Found ${cssLinks.length} CSS links, ${scriptTags.length} script tags`);

  // 2. Fetch active city pages
  console.log('Fetching active city pages…');
  const cities = await query(
    'city_pages',
    'status=eq.active&select=city_slug,city_name,state,meta_title,meta_description,h1_text,hero_intro,base_price,multi_pit_coverage,faq_items,region,local_address,local_city,local_zip'
  );
  console.log(`Found ${cities.length} active city pages`);

  // 3. Generate SEO-rich SPA shell for each city
  for (const city of cities) {
    const dir = join(DIST, city.city_slug, 'river-sand-delivery');
    mkdirSync(dir, { recursive: true });
    const html = buildPage(city, cssLinks, scriptTags);
    writeFileSync(join(dir, 'index.html'), html, 'utf-8');
    console.log(`  ✓ ${city.city_slug}/river-sand-delivery/index.html`);
  }
  console.log(`Pre-rendered ${cities.length} city pages.`);

  // 4. Generate static redirect pages for legacy -la slugs
  for (const { from, to } of LEGACY_REDIRECTS) {
    const dir = join(DIST, from, 'river-sand-delivery');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), buildRedirect(from, to), 'utf-8');
    console.log(`  ↪ ${from}/river-sand-delivery → ${to}/river-sand-delivery`);
  }
  console.log(`Generated ${LEGACY_REDIRECTS.length} legacy redirects.`);

  // 5. Generate static sitemap.xml
  const now = new Date().toISOString().split('T')[0];
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE}/order</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`;

  for (const city of cities) {
    sitemap += `
  <url>
    <loc>${SITE}/${city.city_slug}/river-sand-delivery</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
  }

  sitemap += `\n</urlset>`;
  writeFileSync(join(DIST, 'sitemap.xml'), sitemap, 'utf-8');
  console.log(`✓ sitemap.xml (${cities.length + 2} URLs)`);

  // SPA fallback for GitHub Pages — handles /leads, /order, /order-confirmation etc.
  copyFileSync(join(DIST, 'index.html'), join(DIST, '404.html'));
  console.log('✓ 404.html (SPA fallback)');
}

main().catch((err) => {
  console.error('Pre-render failed:', err);
  process.exit(1);
});
