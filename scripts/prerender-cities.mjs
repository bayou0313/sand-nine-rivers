#!/usr/bin/env node
// Deploy trigger — cache bust
/**
 * Pre-render static HTML for each active city page.
 * Runs after `npm run build` during GitHub Actions deploy.
 * Writes to dist/{citySlug}/river-sand-delivery/index.html
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lclbexhytmpfxzcztzva.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjbGJleGh5dG1wZnh6Y3p0enZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0ODMxMzMsImV4cCI6MjA5MDA1OTEzM30.w8uMZgeAmAOCe2kQ7u-lM4KVWjkzRgVp5qmKBTJrGQg';
const DIST = join(process.cwd(), 'dist');
const SITE = 'https://riversand.net';

const HERO_IMAGE = 'https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/river-sand-product-new-orleans.jpg';
const LOGO_WHITE = 'https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/riversand-logo_WHITE.png.png';
const WAYS_LOGO = 'https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/WAYS_LOGO.png.png';

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

function buildFaqHtml(faqItems) {
  if (!faqItems || !Array.isArray(faqItems) || faqItems.length === 0) return '';
  const items = faqItems.map(
    (f) => `<div class="faq-card"><h3>${esc(f.question || f.q)}</h3><p>${esc(f.answer || f.a)}</p></div>`
  ).join('\n');
  return `<section class="content-section"><h2>Frequently Asked Questions</h2>${items}</section>`;
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

function buildPage(city, allCities) {
  const canonical = `${SITE}/${city.city_slug}/river-sand-delivery`;
  const title = city.meta_title || `River Sand Delivery in ${city.city_name}, ${city.state}`;
  const desc = city.meta_description || `Same-day river sand delivery in ${city.city_name}, ${city.state}. Order online for fast, reliable bulk sand delivery.`;
  const h1 = city.h1_text || `River Sand Delivery in ${city.city_name}, ${city.state} — Same-Day Service`;
  const heroIntro = city.hero_intro || `Same-day bulk river sand delivery to ${city.city_name}, ${city.state}.`;
  const ctaAddress = encodeURIComponent(`${city.city_name}, LA`);

  const breadcrumbSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'River Sand Delivery', item: SITE },
      { '@type': 'ListItem', position: 3, name: city.city_name, item: canonical },
    ],
  });

  const localBusinessSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'River Sand',
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

  const faqSchema = buildFaqSchema(city.faq_items);

  // --- Content sections ---
  const sections = [];
  if (city.why_choose_intro) {
    sections.push(`<section class="content-section"><h2>Why Choose River Sand in ${esc(city.city_name)}</h2><p>${esc(city.why_choose_intro)}</p></section>`);
  }
  if (city.delivery_details) {
    sections.push(`<section class="content-section"><h2>Delivery Details for ${esc(city.city_name)}</h2><p>${esc(city.delivery_details)}</p></section>`);
  }
  if (city.local_uses) {
    sections.push(`<section class="content-section"><h2>Common Uses for River Sand in ${esc(city.city_name)}</h2><div>${city.local_uses}</div></section>`);
  }
  if (city.local_expertise) {
    sections.push(`<section class="content-section"><h2>Local Expertise</h2><p>${esc(city.local_expertise)}</p></section>`);
  }
  if (sections.length === 0 && city.content) {
    sections.push(`<section class="content-section">${city.content}</section>`);
  }
  sections.push(buildFaqHtml(city.faq_items));

  // --- Price bar ---
  let priceBarHtml = '';
  if (city.multi_pit_coverage) {
    priceBarHtml = `<section class="price-bar"><div class="price-bar-inner"><span class="price-label">Pricing varies by location within ${esc(city.city_name)}</span><span class="price-sub">Enter your address for your exact delivery price</span></div></section>`;
  } else if (city.base_price) {
    priceBarHtml = `<section class="price-bar"><div class="price-bar-inner"><span class="price-label">Starting at <strong class="price-amount">$${Number(city.base_price).toFixed(0)}</strong></span><span class="price-sub">per 9 cu yd load · Enter your address for your exact price</span></div></section>`;
  }

  // --- Other cities ---
  const otherCities = allCities.filter((c) => c.city_slug !== city.city_slug).slice(0, 12);
  const otherCitiesHtml = otherCities.length > 0
    ? `<section class="content-section other-cities"><h2>Other Areas We Serve</h2><div class="city-pills">${otherCities.map(
        (c) => `<a class="city-pill" href="${SITE}/${c.city_slug}/river-sand-delivery">${esc(c.city_name)}, ${esc(c.state)}</a>`
      ).join('')}</div></section>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:type" content="website">
<meta name="theme-color" content="#0D2137">
<link rel="icon" href="${SITE}/favicon.png" type="image/png">
<script type="application/ld+json">${breadcrumbSchema}</script>
<script type="application/ld+json">${localBusinessSchema}</script>
${faqSchema ? `<script type="application/ld+json">${faqSchema}</script>` : ''}
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#4a4a4a;line-height:1.8;background:#fff}
a{color:#2563eb;text-decoration:none}
a:hover{text-decoration:underline}
img{max-width:100%;height:auto}

/* ===== NAVBAR ===== */
.navbar{background:#0D2137;padding:0 24px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.navbar-logo img{height:38px;width:auto}
.navbar-right{display:flex;align-items:center;gap:16px}
.navbar-phone{color:#C8A44A;font-weight:600;font-size:.95rem;white-space:nowrap}
.navbar-phone:hover{color:#fff;text-decoration:none}
.btn-order{display:inline-block;padding:10px 24px;background:#c4622d;color:#fff;border-radius:6px;font-weight:700;font-size:.9rem;text-decoration:none;letter-spacing:.3px;transition:background .2s}
.btn-order:hover{background:#a8501f;text-decoration:none}

/* ===== HERO ===== */
.hero{position:relative;min-height:420px;display:flex;align-items:center;justify-content:center;text-align:center;padding:80px 24px 60px;background:linear-gradient(rgba(17,35,20,0.85),rgba(17,35,20,0.85)),url('${HERO_IMAGE}') center/cover no-repeat;color:#fff}
.hero-inner{max-width:800px;width:100%}
.hero h1{font-size:2.4rem;font-weight:800;line-height:1.25;margin-bottom:16px;letter-spacing:-.5px}
.hero-sub{font-size:1.15rem;opacity:.92;margin-bottom:28px;line-height:1.6}
.hero-cta{display:inline-block;padding:16px 40px;background:#c4622d;color:#fff;border-radius:8px;font-weight:700;font-size:1.1rem;text-decoration:none;transition:background .2s,transform .15s}
.hero-cta:hover{background:#a8501f;transform:translateY(-1px);text-decoration:none}
.trust-row{display:flex;justify-content:center;flex-wrap:wrap;gap:20px;margin-top:36px}
.trust-badge{display:flex;align-items:center;gap:6px;font-size:.85rem;opacity:.9;font-weight:500}
.trust-badge svg{width:16px;height:16px;fill:#C8A44A;flex-shrink:0}

/* ===== PRICE BAR ===== */
.price-bar{background:#f8f4ef;padding:28px 24px;text-align:center}
.price-bar-inner{max-width:700px;margin:0 auto}
.price-label{font-size:1.25rem;color:#0D2137;font-weight:600;display:block;margin-bottom:4px}
.price-amount{color:#c4622d;font-size:1.6rem}
.price-sub{font-size:.9rem;color:#666;display:block}

/* ===== CONTENT ===== */
.content-wrap{max-width:800px;margin:0 auto;padding:40px 24px 20px}
.content-section{margin-bottom:32px}
.content-section h2{font-size:1.35rem;color:#0D2137;font-weight:700;border-left:4px solid #C8A44A;padding-left:14px;margin-bottom:16px;line-height:1.4}
.content-section p{margin-bottom:12px;color:#4a4a4a;line-height:1.8}
.content-section ul,.content-section ol{padding-left:1.5rem;margin:12px 0}
.content-section li{margin:6px 0;line-height:1.7;color:#4a4a4a}

/* ===== FAQ CARDS ===== */
.faq-card{background:#f8f8f8;border-radius:8px;padding:20px 24px;margin-bottom:12px}
.faq-card h3{font-size:1.05rem;color:#0D2137;font-weight:700;margin-bottom:8px}
.faq-card p{color:#4a4a4a;margin:0;line-height:1.7;font-size:.95rem}

/* ===== OTHER CITIES ===== */
.city-pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.city-pill{display:inline-block;padding:8px 16px;background:#f0f0f0;border-radius:20px;font-size:.85rem;color:#0D2137;font-weight:500;text-decoration:none;transition:background .15s}
.city-pill:hover{background:#ddd;text-decoration:none}

/* ===== CTA BANNER ===== */
.cta-banner{text-align:center;padding:48px 24px;background:#faf6f1;margin-top:24px}
.cta-banner p{font-size:1.15rem;color:#0D2137;font-weight:600;margin-bottom:16px}

/* ===== FOOTER ===== */
.footer{background:#0D2137;color:#fff;padding:48px 24px 24px;margin-top:0}
.footer-inner{max-width:960px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr 1fr;gap:32px}
.footer-col h4{font-size:.95rem;font-weight:700;margin-bottom:14px;color:#C8A44A;text-transform:uppercase;letter-spacing:.5px}
.footer-col p,.footer-col a{font-size:.88rem;color:rgba(255,255,255,.8);line-height:1.9}
.footer-col a:hover{color:#C8A44A;text-decoration:none}
.footer-logo{margin-bottom:16px}
.footer-logo img{height:32px;width:auto;opacity:.85}
.footer-bottom{max-width:960px;margin:32px auto 0;padding-top:20px;border-top:1px solid rgba(255,255,255,.12);text-align:center;font-size:.8rem;color:rgba(255,255,255,.5)}

/* ===== MOBILE ===== */
@media(max-width:768px){
  .navbar{padding:0 16px;height:56px}
  .navbar-logo img{height:30px}
  .navbar-phone{display:none}
  .btn-order{padding:8px 16px;font-size:.8rem}
  .hero{min-height:340px;padding:60px 20px 48px}
  .hero h1{font-size:1.7rem}
  .hero-sub{font-size:1rem}
  .hero-cta{padding:14px 28px;font-size:1rem}
  .trust-row{gap:12px}
  .trust-badge{font-size:.78rem}
  .price-label{font-size:1.1rem}
  .price-amount{font-size:1.35rem}
  .content-wrap{padding:28px 16px 16px}
  .content-section h2{font-size:1.15rem}
  .footer-inner{grid-template-columns:1fr;gap:24px}
  .footer-bottom{font-size:.75rem}
}
</style>
</head>
<body>

<!-- NAVBAR -->
<nav class="navbar">
<a class="navbar-logo" href="${SITE}"><img src="${LOGO_WHITE}" alt="River Sand — Same-Day Delivery" height="38"></a>
<div class="navbar-right">
<a class="navbar-phone" href="tel:18554689297">1-855-GOT-WAYS</a>
<a class="btn-order" href="${SITE}/?address=${ctaAddress}">ORDER NOW</a>
</div>
</nav>

<!-- HERO -->
<section class="hero">
<div class="hero-inner">
<h1>${esc(h1)}</h1>
<p class="hero-sub">${esc(heroIntro)}</p>
<a class="hero-cta" href="${SITE}/?address=${ctaAddress}">Check Delivery to ${esc(city.city_name)} →</a>
<div class="trust-row">
<span class="trust-badge"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>4.9-star rated</span>
<span class="trust-badge"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>500+ loads delivered</span>
<span class="trust-badge"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>Same-day available</span>
<span class="trust-badge"><svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>Licensed &amp; insured</span>
</div>
</div>
</section>

<!-- PRICE BAR -->
${priceBarHtml}

<!-- CONTENT -->
<div class="content-wrap">
${sections.join('\n')}
${otherCitiesHtml}
</div>

<!-- CTA BANNER -->
<section class="cta-banner">
<p>Ready to order river sand in ${esc(city.city_name)}?</p>
<a class="hero-cta" href="${SITE}/?address=${ctaAddress}">Get Your Delivery Price →</a>
</section>

<!-- FOOTER -->
<footer class="footer">
<div class="footer-inner">
<div class="footer-col">
<div class="footer-logo"><img src="${WAYS_LOGO}" alt="WAYS Materials" height="32"></div>
<h4>Contact</h4>
<p><a href="tel:18554689297">1-855-GOT-WAYS</a></p>
<p><a href="mailto:info@ways.us">info@ways.us</a></p>
<p>Serving Greater New Orleans</p>
</div>
<div class="footer-col">
<h4>Quick Links</h4>
<p><a href="${SITE}/">Home</a></p>
<p><a href="${SITE}/#estimator">Get a Price</a></p>
<p><a href="${SITE}/order">Place an Order</a></p>
</div>
<div class="footer-col">
<h4>Service Areas</h4>
${allCities.slice(0, 6).map(c => `<p><a href="${SITE}/${c.city_slug}/river-sand-delivery">${esc(c.city_name)}</a></p>`).join('\n')}
</div>
</div>
<div class="footer-bottom">© ${new Date().getFullYear()} WAYS® Materials LLC · All rights reserved</div>
</footer>

</body>
</html>`;
}

async function main() {
  console.log('Fetching active city pages…');
  const cities = await query('city_pages', 'status=eq.active&select=city_slug,city_name,state,meta_title,meta_description,h1_text,hero_intro,base_price,multi_pit_coverage,faq_items,local_uses,local_expertise,delivery_details,why_choose_intro,content,region');
  console.log(`Found ${cities.length} active city pages`);

  for (const city of cities) {
    const dir = join(DIST, city.city_slug, 'river-sand-delivery');
    mkdirSync(dir, { recursive: true });
    const html = buildPage(city, cities);
    writeFileSync(join(dir, 'index.html'), html, 'utf-8');
    console.log(`  ✓ ${city.city_slug}/river-sand-delivery/index.html`);
  }

  console.log(`Pre-rendered ${cities.length} city pages.`);

  // Generate static redirect pages for legacy -la slugs
  for (const { from, to } of LEGACY_REDIRECTS) {
    const dir = join(DIST, from, 'river-sand-delivery');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), buildRedirect(from, to), 'utf-8');
    console.log(`  ↪ ${from}/river-sand-delivery → ${to}/river-sand-delivery`);
  }
  console.log(`Generated ${LEGACY_REDIRECTS.length} legacy redirects.`);

  // Generate static sitemap.xml
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
}

main().catch((err) => {
  console.error('Pre-render failed:', err);
  process.exit(1);
});
