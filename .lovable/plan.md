

## Plan: Store Structured Content in Individual Columns

### Problem
The AI prompt and tool-call schema are correct, but the `generate-city-page` function only writes to `meta_title`, `meta_description`, `h1_text`, and the legacy `content` blob. The 6 new structured columns added by the migration are never populated.

### Fix — `supabase/functions/generate-city-page/index.ts` (lines 209-219)

Update the `.update()` call to store each structured field in its own column:

```typescript
.update({
  meta_title: generated.meta_title,
  meta_description: generated.meta_description,
  h1_text: generated.h1_text,
  hero_intro: generated.hero_intro,
  why_choose_intro: generated.why_choose_intro,
  delivery_details: generated.delivery_details,
  local_uses: `<ul>${(generated.local_uses || []).map(i => `<li>${i}</li>`).join("")}</ul>`,
  local_expertise: generated.local_expertise,
  faq_items: generated.faq_items,
  content: fullContent,  // keep legacy blob as fallback
  content_generated_at: new Date().toISOString(),
  status: "active",
})
```

Also update the response JSON to include all structured fields so the frontend can use them immediately without a refetch.

### Files Changed

| File | Change |
|---|---|
| `supabase/functions/generate-city-page/index.ts` | Add 5 structured fields to the `.update()` call (lines 209-219) |

### Not Changed
- AI prompt, tool schema, system instructions — already correct
- `CityPage.tsx`, component props — already updated to read these columns
- `leads-auth`, admin UI, pricing, auth, RLS

