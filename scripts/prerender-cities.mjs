#!/usr/bin/env node
/**
 * Pre-render static HTML for each active city page.
 * Runs after `npm run build` during GitHub Actions deploy.
 * Writes to dist/{citySlug}/river-sand-delivery/index.html
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DIST = join(process.cwd(), 'dist');
const SITE = 'https://riversand.net';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
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
    (f) => `<div class="faq-item"><h3>${esc(f.question || f.q)}</h3><p>${esc(f.answer || f.a)}</p></div>`
  ).join('\n');
  return `<section class="faq"><h2>Frequently Asked Questions</h2>${items}</section>`;
}

function buildFaqSchema(faqItems, city) {
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

  const faqSchema = buildFaqSchema(city.faq_items, city);

  const sections = [];

  if (city.why_choose_intro) {
    sections.push(`<section><h2>Why Choose River Sand in ${esc(city.city_name)}</h2><p>${esc(city.why_choose_intro)}</p></section>`);
  }
  if (city.delivery_details) {
    sections.push(`<section><h2>Delivery Details for ${esc(city.city_name)}</h2><p>${esc(city.delivery_details)}</p></section>`);
  }
  if (city.local_uses) {
    sections.push(`<section><h2>Common Uses for River Sand in ${esc(city.city_name)}</h2><p>${esc(city.local_uses)}</p></section>`);
  }
  if (city.local_expertise) {
    sections.push(`<section><h2>Local Expertise</h2><p>${esc(city.local_expertise)}</p></section>`);
  }

  if (sections.length === 0 && city.content) {
    sections.push(`<section>${city.content}</section>`);
  }

  sections.push(buildFaqHtml(city.faq_items));

  let priceHtml = '';
  if (city.multi_pit_coverage) {
    priceHtml = `<p class="price-note">Pricing varies by location within ${esc(city.city_name)}. Enter your address for your exact delivery price.</p>`;
  } else if (city.base_price) {
    priceHtml = `<p class="price">Starting at <strong>$${Number(city.base_price).toFixed(0)}</strong> per 9 cu yd load</p>`;
  }

  const otherCities = allCities
    .filter((c) => c.city_slug !== city.city_slug)
    .slice(0, 8);
  const otherCitiesHtml = otherCities.length > 0
    ? `<section class="other-cities"><h2>Other Areas We Serve</h2><ul>${otherCities.map(
        (c) => `<li><a href="${SITE}/${c.city_slug}/river-sand-delivery">River Sand Delivery in ${esc(c.city_name)}, ${esc(c.state)}</a></li>`
      ).join('')}</ul></section>`
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
<script type="application/ld+json">${breadcrumbSchema}</script>
<script type="application/ld+json">${localBusinessSchema}</script>
${faqSchema ? `<script type="application/ld+json">${faqSchema}</script>` : ''}
<style>
body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:0;color:#1a1a1a;line-height:1.6}
.wrap{max-width:800px;margin:0 auto;padding:24px 16px}
h1{font-size:2rem;margin-bottom:.5rem}
h2{font-size:1.4rem;margin-top:2rem;border-bottom:2px solid #e5e5e5;padding-bottom:.25rem}
h3{font-size:1.1rem;margin-top:1.2rem}
.hero-intro{font-size:1.15rem;color:#444}
.price{font-size:1.3rem;margin:1rem 0}
.price-note{color:#666;font-style:italic;margin:1rem 0}
a{color:#2563eb}
.other-cities ul{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.other-cities li{background:#f5f5f5;padding:6px 12px;border-radius:6px}
.other-cities a{text-decoration:none;font-size:.9rem}
.faq-item{margin:1rem 0}
.cta{text-align:center;margin:2.5rem 0;padding:2rem;background:#f0f9ff;border-radius:12px}
.cta a{display:inline-block;padding:12px 32px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600}
</style>
</head>
<body>
<div class="wrap">
<h1>${esc(h1)}</h1>
<p class="hero-intro">${esc(heroIntro)}</p>
${priceHtml}
<div class="cta"><a href="${SITE}/#estimator">Get Your Delivery Price →</a></div>
${sections.join('\n')}
${otherCitiesHtml}
<div class="cta"><a href="${SITE}/#estimator">Order River Sand Delivery Now →</a></div>
<footer><p>© ${new Date().getFullYear()} River Sand. <a href="${SITE}">Home</a></p></footer>
</div>
<script>
if(window.location.hash||document.referrer.includes('riversand.net')){
}
</script>
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
}

main().catch((err) => {
  console.error('Pre-render failed:', err);
  process.exit(1);
});
