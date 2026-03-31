

## Plan: Tighten city page AI prompt to v3.0

Two changes in `supabase/functions/generate-city-page/index.ts`:

### 1. Replace CONTENT REQUIREMENTS fields (lines 121-130)

Replace the 6 field instructions (hero_intro, why_choose_intro, delivery_details, local_uses, local_expertise, faq_items) with the user's exact tightened versions that add:
- Character limits to every field
- Required keyword inclusion ("river sand", city name, parish name)
- Stricter sentence count constraints (most fields now ONE sentence)
- FAQ character caps (80 chars questions, 160 chars answers)

Lines 121-129 will be replaced with the new field definitions verbatim as provided.

### 2. Bump prompt_version (line 231)

Change `prompt_version: "2.0"` → `prompt_version: "3.0"` so all existing pages are flagged as outdated and queued for regeneration on the next Regen Outdated run.

### Files changed
- `supabase/functions/generate-city-page/index.ts` (2 edits, same file)

No other files affected. The edge function will be auto-deployed.

