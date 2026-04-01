

## Fix Abandoned Sessions: Broaden Query & Enhance Table

### Changes

#### 1. `supabase/functions/leads-auth/index.ts` — Broaden `list_abandoned` query (lines 600-613)

Replace the current query to:
- Expand stages to `["got_price", "clicked_order_now", "entered_address", "started_checkout", "reached_payment"]`
- Remove `.not("customer_email", "is", null)` filter
- Add 30-minute staleness filter: `.lt("updated_at", thirtyMinAgo)`
- Add debug logging for stages found

#### 2. `src/pages/Leads.tsx` — Update abandoned sessions table (lines 3870-3935)

- **Header text** (line 3873): Change "abandoned sessions with email" → "abandoned sessions"
- **Stage column** (lines 3903-3908): Color-code by stage:
  - `got_price` → amber
  - `clicked_order_now` → orange  
  - `entered_address` → blue
  - `started_checkout` → red
  - `reached_payment` → red bold
- **Email column** (line 3912): Show gray "No email" when null instead of "—"
- **Location column** (line 3902): Already shows geo_city/region — add fallback to extract from delivery_address when geo is missing

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/leads-auth/index.ts` | Broaden stage filter, remove email requirement, add staleness filter |
| `src/pages/Leads.tsx` | Stage color-coding, handle missing email, location fallback |

