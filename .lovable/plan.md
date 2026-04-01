

## Fix: Abandoned Sessions Not Populating

### Root Cause
`Order.tsx` never calls `initSession()`. If a visitor arrives directly at `/order` (or the session row doesn't exist yet), all `updateSession()` calls silently update zero rows. The `list_abandoned` query then finds nothing.

### Changes

#### 1. `src/pages/Order.tsx` — Add `initSession` on mount
- Change import on line 3: `import { updateSession, initSession } from "@/lib/session";`
- Add `useEffect(() => { initSession(); }, []);` near the top of the component body

#### 2. `supabase/functions/leads-auth/index.ts` — Make `session_update` upsert-safe (line 136)
Change:
```typescript
await sb.from("visitor_sessions").update(safe).eq("session_token", session_token);
```
To:
```typescript
console.log("[session_update] token:", session_token?.slice(0, 8));
console.log("[session_update] updates:", JSON.stringify(updates));
await sb.from("visitor_sessions").upsert(
  { session_token, ...safe },
  { onConflict: "session_token", ignoreDuplicates: false }
);
```

#### 3. `supabase/functions/leads-auth/index.ts` — Add logging to `list_abandoned` (after line 491)
Add after the query:
```typescript
console.log("[list_abandoned] found:", data?.length, "sessions");
```

#### 4. Verify existing `updateSession` calls in Order.tsx ✅
Already confirmed present and correct:
- **Line 573**: `stage: "started_checkout"` with address, price, name, phone
- **Line 609**: `stage: "reached_payment"` with email, name, phone  
- **Line 682/334**: `stage: "completed_order"` with order_id

#### 5. Redeploy `leads-auth` edge function

### Files Changed

| File | Change |
|------|--------|
| `src/pages/Order.tsx` | Import + call `initSession()` on mount |
| `supabase/functions/leads-auth/index.ts` | `session_update`: change `.update()` → `.upsert()`, add logging; `list_abandoned`: add logging |

