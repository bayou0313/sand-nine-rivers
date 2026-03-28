

## Update Parish Tax Rates — Dynamic Lookup from Google Maps

### Overview
Replace the hardcoded tax rates with the user-provided parish rates, and extract the parish directly from the Google Maps `administrative_area_level_2` component for accurate matching.

---

### Step 1 — Update `src/lib/format.ts`

**A. Replace `PARISH_TAX_RATES` with the new rates:**
```
"jefferson": 0.0975,
"orleans": 0.1000,
"st. bernard": 0.1000,
"st. charles": 0.1000,
"st. tammany": 0.0925,
"plaquemines": 0.0975,
"st. john the baptist": 0.1025,
"st. james": 0.0850,
"lafourche": 0.0970,
"tangipahoa": 0.0945,
```
Remove `terrebonne` and `washington` (not in the new list).

**B. Update `DEFAULT_TAX_RATE`** to `0.0975` (9.75%).

**C. Update default parish label** to `"Unknown Parish (default)"`.

**D. Add new exported function `getParishFromPlaceResult`:**
```typescript
export function getParishFromPlaceResult(
  addressComponents: Array<{ long_name: string; short_name: string; types: string[] }>
): string | null {
  const county = addressComponents.find(c => c.types.includes("administrative_area_level_2"));
  if (!county) return null;
  // Google returns "Jefferson Parish" — strip " Parish" suffix for lookup
  return county.long_name.replace(/ Parish$/i, "").toLowerCase();
}
```

**E. Add `getTaxRateByParish(parishName: string)` function** that looks up the rate by parish key (used when we have the structured parish name from Google).

**F. Update city-to-parish mapping** — change `"st. john"` entries to `"st. john the baptist"` to match the new key.

---

### Step 2 — Update `src/pages/Order.tsx`

**A. Extract parish from Google Places autocomplete** (line ~290):
In the `place_changed` listener, extract `administrative_area_level_2` from `place.address_components` and store it in a new state variable `detectedParish`.

```typescript
const [detectedParish, setDetectedParish] = useState<string | null>(null);

// In place_changed listener:
autocompleteRef.current.addListener("place_changed", () => {
  const place = autocompleteRef.current?.getPlace();
  if (place?.formatted_address) setAddress(place.formatted_address);
  if (place?.address_components) {
    const parish = getParishFromPlaceResult(place.address_components);
    setDetectedParish(parish);
  }
});
```

**B. Update `taxInfo` memo** to prefer `detectedParish` (structured Google data) over address string matching:
```typescript
const taxInfo = useMemo(() => {
  if (detectedParish) return getTaxRateByParish(detectedParish);
  return getTaxRateFromAddress(address);
}, [address, detectedParish]);
```

**C. Update tax display labels** — already shows `taxInfo.parish` in three places (lines ~807, ~995, ~1212). Update the format to: `"Sales tax — Jefferson Parish (9.75%)"` instead of `"Sales Tax (9.20% — Jefferson Parish)"`.

**D. Pass `tax_parish` to order data** — add `tax_parish: taxInfo.parish` to the order insert and email payloads so it's available in emails/invoices.

---

### Step 3 — Update `supabase/functions/send-email/index.ts`

Update the tax display line (~line 209) to show parish name with rate:
```
`Sales tax — ${order.tax_parish || 'N/A'} (${(Number(order.tax_rate) * 100).toFixed(2)}%)`
```

---

### Step 4 — Update `supabase/functions/generate-invoice/index.ts`

Same label update (~line 231):
```
`Sales Tax — ${order.tax_parish || ''} (${(order.tax_rate * 100).toFixed(2)}%)`
```

---

### Files Changed
| File | Change |
|------|--------|
| `src/lib/format.ts` | New rates, new `getParishFromPlaceResult()` and `getTaxRateByParish()` functions |
| `src/pages/Order.tsx` | Extract parish from Google Places, update tax display labels, pass `tax_parish` |
| `supabase/functions/send-email/index.ts` | Show parish name in tax label |
| `supabase/functions/generate-invoice/index.ts` | Show parish name in tax label |

### No database migration needed
The `tax_parish` can be stored in the existing `notes` or passed as email-only data. If you want a dedicated column, a small migration would add `tax_parish text` to the orders table — but this is optional.

