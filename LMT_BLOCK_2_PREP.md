# LMT BLOCK 2 PREP — Seed Catalog Data

Version: 1.0 (2026-04-26)
For: Block 2 of WAYS_LMT_UNIFICATION_v2 sequence
Status: **Pre-execution data gathering. No code or schema changes.**

This doc consolidates the input data and architectural decisions required
before Block 2 (catalog seed) can be authored as a propose-only migration.
Bracketed `[TBD: ...]` items are blocking decisions that must be answered
before the seed SQL can be written.

---

## 0. Live state (verified 2026-04-26 against production)

### Active pits (5)

| Pit | UUID | Address | base_price | free_miles | $/extra mi | max_dist | sat_only | min_trip |
|-----|------|---------|-----------:|-----------:|-----------:|---------:|:--------:|---------:|
| Beverly Bridge City        | `ac8ed629-f9d1-4857-b265-dceedd1a79f1` | 1215 River Rd, Bridge City, LA 70094     | $202 | 15 | $4.49 | 30 | false | $0 |
| Beverly Chalmette          | `7cb0a701-a28e-430a-8389-056dfef539a3` | 1200 E St Bernard Hwy, Chalmette, LA     | $211 | 15 | $4.49 | 40 | false | $0 |
| Beverly Hahnville          | `c781ae1d-5d05-4d4b-bbf3-5f08b1d66127` | 15427 River Rd, Hahnville, LA 70057      | $202 | 15 | $4.49 | 30 | false | $0 |
| Wood Materials Harahan, LA | `f8cc1240-67a8-4f59-9477-8c5deffc2c41` | 6148 River Rd, Harahan, LA 70123         | $216 | 15 | $4.49 | 30 | false | $0 |
| Woods Materials Algiers    | `5bf73288-a730-4e75-a96b-51e010e03a92` | 11302 Patterson Rd, New Orleans, LA 70131| $214 | 15 | $4.49 | 30 | false | $0 |

Notes:
- Bridge City spelling is **"Bridge City"**; the existing record reads "Beverly Bridge City". Hahnville is currently spelled **"Hanhville"** in the DB — typo to fix in a separate cleanup, not Block 2.
- All five have `is_pickup_only=false`, `vendor_relationship=NULL`, `saturday_only=false`, `min_trip_charge=0`. Block 1 added these columns; values were defaulted, **not** populated. Block 2 does not need to set these — defer to a pit-config block.
- Wood Materials Harahan needs `saturday_only=true` per current ops. **Decision deferred** — propose handling in Block 3 (pit-config), not Block 2.

### Relevant global_settings (verified)

| key | value |
|-----|-------|
| pricing_mode | `baked` |
| card_processing_fee_percent | `3.5` |
| card_processing_fee_fixed | `0.30` |
| cod_discount_percent | `3.5` |
| saturday_surcharge | `35.00` |
| max_daily_limit | `10` |

The current 5 pit base_price values ($202 / $211 / $202 / $216 / $214) are
**delivered, baked-in prices for a 9 yd³ load of river sand**. They are
not per-unit. This is the central architectural tension for Block 2.

---

## 1. Products to seed (target: 14 from YTD breakdown)

| slug                    | name                  | category | sub_category | unit | weight_per_unit | source for confirmation |
|-------------------------|-----------------------|----------|--------------|------|-----------------|-------------------------|
| river_sand              | River Sand            | sand     | —            | yd³  | [TBD: ~1.35 ton/yd³] | only product currently sold via riversand.net |
| spillway_dirt           | Spillway Dirt         | dirt     | —            | yd³  | [TBD]           | YTD breakdown |
| limestone_57            | #57 Limestone         | rock     | gradation    | ton  | [TBD: 1.0]      | YTD breakdown |
| limestone_610           | #610 Limestone        | rock     | gradation    | ton  | [TBD: 1.0]      | YTD breakdown |
| limestone_9             | #9 Limestone          | rock     | gradation    | ton  | [TBD: 1.0]      | YTD breakdown |
| limestone_4             | #4 Limestone          | rock     | gradation    | ton  | [TBD: 1.0]      | YTD breakdown |
| crushed_concrete        | Crushed Concrete      | rock     | —            | ton  | [TBD: 1.0]      | YTD breakdown |
| pea_gravel              | Pea Gravel            | gravel   | —            | ton  | [TBD: 1.0]      | YTD breakdown |
| masonry_sand            | Masonry Sand          | sand     | —            | yd³  | [TBD]           | YTD breakdown |
| concrete_sand           | Concrete Sand         | sand     | —            | yd³  | [TBD]           | YTD breakdown |
| pine_mulch              | Pine Mulch            | mulch    | —            | yd³  | [TBD]           | YTD breakdown |
| red_mulch               | Red Mulch             | mulch    | —            | yd³  | [TBD]           | YTD breakdown |
| organic_garden_soil     | Organic Garden Soil   | soil     | —            | yd³  | [TBD]           | YTD breakdown |
| affordable_garden_soil  | Affordable Garden Soil| soil     | —            | yd³  | [TBD]           | YTD breakdown |

**Block 2 inserts:** `id (gen_random_uuid)`, `slug`, `name`, `category`, `sub_category`, `unit`, `weight_per_unit`. Defer `description`, `long_description_template`, `image_urls`, `use_cases` to a Block 2.5 backfill — the schema allows NULL and these are content/SEO fields, not pricing-critical.

**Decisions needed:**
- **D1** Confirm the 14-product list matches current YTD breakdown (or provide the actual list).
- **D2** `weight_per_unit` values — needed for capacity/load math in Block 4. If not known precisely, ship Block 2 with NULL and backfill.
- **D3** Slug naming convention — proposing snake_case (matches above). Confirm.

---

## 2. Pit inventory matrix

`pit_inventory` rows are required for every (pit, product) combination
that's actually stocked. Schema requires: `pit_id`, `product_id`,
`price_per_unit`, `min_quantity` (default 1), `available` (default true).
Optional: `wholesale_cost`, `max_quantity_per_load`, `notes`.

### What we know today (RS / river sand only)

| Pit                        | river_sand current delivered base_price (9 yd³, baked) |
|----------------------------|--------------------------------------------------------|
| Beverly Bridge City        | $202 |
| Beverly Chalmette          | $211 |
| Beverly Hahnville          | $202 |
| Woods Materials Algiers    | $214 |
| Wood Materials Harahan, LA | $216 |

Note: these are **load-bundle prices**, not per-yd³ prices. The "5 pits all
sell river sand" matrix is the only one we have direct data for. For all
other 13 products × 5 pits = 65 rows, **availability and pricing are TBD**.

### The architectural tension (must resolve before any seed is written)

The v2 pit-driven spec models `pit_inventory.price_per_unit` as a **per-unit**
price (e.g. $/yd³ or $/ton). Today's RS reality is **per-load**:
- Customer picks a pit (or system picks nearest)
- They get a load of N yd³ (currently fixed at 9, but UI lets 1–10)
- Total = base_price + extra-mile fee × distance + surcharges + tax

If we naively divide $202/9 = $22.44/yd³ for Bridge City river sand, that
becomes the per-unit price. But the existing `calcPitPrice` formula in
`src/lib/pits.ts` does `unitPrice = max(base_price, base_price + extraMiles
× extra_per_mile)` and then `× qty` — meaning the extra-mile fee is
**per-load**, not per-yd³. Re-deriving per-unit prices breaks that math.

**Recommendation: Block 2 stores per-unit prices as a forward-compatible
data model, but Block 4 (calculate_quote) is what actually consumes them.
Until Block 4 is built and validated, the live order flow continues to
read pits.base_price + pits.price_per_extra_mile from the existing pits
table. The two coexist.** This is the cleanest path: seed the new shape,
do not migrate the existing pricing reads, and resolve the per-unit vs
per-load semantics inside Block 4 with a documented translation rule.

If that's accepted, the seed values for Block 2 would be:

| Pit | Product | Proposed price_per_unit | Method |
|-----|---------|------------------------:|--------|
| Bridge City | river_sand | [TBD: $22.44/yd³ ?] | $202 ÷ 9 |
| Chalmette   | river_sand | [TBD: $23.44/yd³ ?] | $211 ÷ 9 |
| Hahnville   | river_sand | [TBD: $22.44/yd³ ?] | $202 ÷ 9 |
| Algiers     | river_sand | [TBD: $23.78/yd³ ?] | $214 ÷ 9 |
| Harahan     | river_sand | [TBD: $24.00/yd³ ?] | $216 ÷ 9 |

**Decisions needed (in order of importance):**
- **D4** [BLOCKING] Per-unit vs per-load pricing semantics in `pit_inventory.price_per_unit`. Recommendation: per-unit, with translation handled in Block 4.
- **D5** [BLOCKING] What is the actual per-yd³ wholesale and retail cost of river sand at each pit? (Today's $202 / $211 / etc. are deliberately bundled. The customer-facing $/yd³ is implied, never published.)
- **D6** Full pit × product availability map. We need a 14×5 matrix marked with which combos are actually stocked. Proposing default: river_sand at all 5; everything else `available=false` until we get vendor confirmations. Confirm.
- **D7** Wholesale costs (margin tracking) — optional v1, ship NULL and backfill in Ops phase.
- **D8** `max_quantity_per_load` — current ops cap is 10 for all RS; propose 10 for all yd³ products, [TBD] for ton-based.
- **D9** `min_quantity` — propose 1 for all (matches schema default).

---

## 3. Storefronts to seed

| id | name           | domain              | stripe_account_id      | brand_name     | active |
|----|----------------|---------------------|------------------------|----------------|--------|
| RS | RiverSand.net  | riversand.net       | acct_1TH4PcPuKuZka3yZ  | RiverSand      | true   |
| WM | WAYS Materials | [TBD: waysmaterials.com vs ways.us] | acct_1Rs9KNLVhHPhPfIV | WAYS Materials | true   |

**Decisions needed:**
- **D10** Confirm WM domain. `waysmaterials.com` vs `ways.us`. CLAUDE.md mentions ways.us as a future master brand — likely `waysmaterials.com` is the immediate WM storefront.
- **D11** `support_email` per storefront. RS = `orders@riversand.net` (verified in global_settings.email_from). WM = [TBD].
- **D12** `support_phone` per storefront. RS = `1-855-GOT-WAYS` (verified). WM = [TBD: shared 1-855 vs own DID]. Note: `WAYS_PHONE_*` constants in `src/lib/constants.ts` use the 1-855 number for all WAYS surfaces, suggesting shared.
- **D13** `logo_url` per storefront — likely both point to assets in the `assets` storage bucket. [TBD].

---

## 4. App configurations

Schema for `app_configurations`: `storefront_id`, `pit_ids`, `product_ids`
(NULL = all from configured pits), `pricing_mode`, `per_mile_rate`,
`free_miles`, `saturday_surcharge`, `processing_fee_pct`, `min_trip_charge`,
`branding_meta` (jsonb), `ui_flags` (jsonb).

### RS configuration (proposed, derived from live globals)

| field | value | source |
|-------|-------|--------|
| storefront_id | `RS` | — |
| pit_ids | `[ac8ed629…, 7cb0a701…, c781ae1d…, f8cc1240…, 5bf73288…]` (all 5) | pits table |
| product_ids | `NULL` (all products from configured pits) | — |
| pricing_mode | `baked` | global_settings.pricing_mode |
| per_mile_rate | `4.49` | uniform across all 5 pits today |
| free_miles | `15` | uniform across all 5 pits today |
| saturday_surcharge | `35.00` | global_settings.saturday_surcharge |
| processing_fee_pct | `3.5` | global_settings.card_processing_fee_percent |
| min_trip_charge | `NULL` | not set today |
| branding_meta | `{"primary":"#0D2137","accent":"#C07A00","background":"#F5F5F0","palette":"midnight_sage"}` | global_settings.brand_* |
| ui_flags | `{}` | — |

### WM configuration (all blocking)

| field | value |
|-------|-------|
| storefront_id | `WM` |
| pit_ids | [TBD: D14 — same 5? subset? different pits entirely?] |
| product_ids | [TBD: D15 — full 14? subset? different SKUs?] |
| pricing_mode | [TBD: D16 — `baked` vs `transparent`? WM may want transparent] |
| per_mile_rate | [TBD: D17] |
| free_miles | [TBD: D18] |
| saturday_surcharge | [TBD: D19] |
| processing_fee_pct | [TBD: D20] |
| min_trip_charge | [TBD: D21] |
| branding_meta | [TBD: D22 — WM colors] |
| ui_flags | [TBD] |

---

## 5. Open architectural questions (recap)

1. **[D4] Per-unit vs per-load pricing in `pit_inventory`.** Most consequential. Recommendation: per-unit, translation rule lives in Block 4. Without this answered, no pricing values can be seeded.
2. **Pricing precedence: `pit_inventory.price_per_unit` vs `app_configurations` rules.** When RS sells river_sand from Bridge City, does the unit price come from `pit_inventory`, do per-mile/free_miles come from `app_configurations`, and is `saturday_surcharge` storefront-level or pit-level? The v2 spec implies Block 4's `calculate_quote` orchestrates this — but the layering rule needs to be explicit before Block 4 is written. **Defer to Block 4 prep, but flag it now so we don't seed contradictory data.**
3. **What does WM actually sell vs RS?** Same products at same pits but different storefront/branding/pricing? Or different inventory entirely? Affects D6 + D14 + D15.
4. **`saturday_only` propagation.** If Wood Materials Harahan is `saturday_only=true`, does that flag live on `pits` only (Block 1 added it there) or does `app_configurations.ui_flags` need a parallel signal? Recommendation: pit-level only, storefronts inherit transparently.

---

## 6. Recommended next decisions (priority-ordered)

Block 2 is **blocked** until the following are answered:

1. **D4** — per-unit vs per-load pricing semantics. (Without this, no `price_per_unit` values can be written.)
2. **D5** — actual per-yd³ retail prices for river_sand at each of the 5 pits.
3. **D6** — pit × product availability matrix (or default: river_sand-only with the rest `available=false`).
4. **D1, D2** — confirm 14-product list and weight_per_unit values (or accept NULL weights for v1).
5. **D10–D22** — WM storefront + app_configurations values. If WM rollout isn't imminent, **defer all WM rows to Block 2b** and ship Block 2a with RS-only.

Block 2 can ship with these **safely deferred:**
- Product `description`, `long_description_template`, `image_urls`, `use_cases` → Block 2.5 content backfill.
- `pit_inventory.wholesale_cost` → ship NULL, backfill in Ops phase.
- `addresses` table → empty until customer-flow rewires write to it (Block 5+).
- `customers_v2` table → empty until customer-flow rewires write to it (Block 5+).
- Wood Materials Harahan `saturday_only=true` flip → pit-config block.
- Hahnville → Hahnville spelling fix → pit-config block.

---

**End of Block 2 prep. No SQL written. Awaiting decisions D1–D22.**
