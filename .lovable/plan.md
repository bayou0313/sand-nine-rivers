

## Investigation

Let me check the current state of the `check_google_integrations` action and pull recent logs to identify the actual failure.
<lov-tool-use id="toolu_vrtx_01RM4tH2sR25xDNzeQAprrx5" name="supabase--edge_function_logs" integration-id="supabase" data="{\"function_name\": \"leads-auth\", \"search\": \"check_google_integrations\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01UJfFUegB8ftp8iFswDNuxy" name="code--search_files" integration-id="code" data="{\"query\": \"check_google_integrations\", \"include_patterns\": \"supabase/functions/leads-auth/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01PKhXN45yjCZLUn9R1oFSgj" name="supabase--edge_function_logs" integration-id="supabase" data="{\"function_name\": \"leads-auth\", \"search\": \"check_google_integrations\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Rxj7uad11XtHhRrAxn1uhy" name="code--search_files" integration-id="code" data="{\"query\": \"check_google_integrations\", \"include_patterns\": \"supabase/functions/leads-auth/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01EbtL4tWBkrJcXY4w2su8Cn" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/leads-auth/index.ts\", \"lines\": \"1555-1635\"}">
</lov-tool-use>
The code at lines 1559-1621 is syntactically clean — no stripped regex characters, results declaration is correct, try/catch wraps everything, always returns 200. The 400 is not coming from a syntax error.

Let me check what 400 paths exist in the function (auth, body parsing) that could fire before reaching this action.
<lov-tool-use id="toolu_vrtx_01Qv452R9k5rzEDne1njYs7Z" name="code--search_files" integration-id="code" data="{\"query\": \"status: 400\", \"include_patterns\": \"supabase/functions/leads-auth/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01LDGcT3t1t3D4A7owwAXfDp" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/leads-auth/index.ts\", \"lines\": \"1-80\"}">
</lov-tool-use>
Let me check the auth gate / password check at the top of the action router to see why a 400 might fire before reaching `check_google_integrations`.
<lov-tool-use id="toolu_vrtx_011A4h7xRfuWN4Lwx6C8nsFZ" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"supabase/functions/leads-auth/index.ts\", \"query\": \"password|Invalid password|Missing password|Unauthorized\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_019egycuNfeZioU4z4GX1gMn" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"src/pages/Leads.tsx\", \"query\": \"check_google_integrations\"}">
</lov-tool-use>
Found the bug. The action checker in `check_google_integrations` has NO password gate — it falls through. But there's likely a global password check at the bottom of the router (the unmatched `else` returning 400). Let me verify.
<lov-tool-use id="toolu_vrtx_01MdpMF5LA5ncKHB1D9Uee7L" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/leads-auth/index.ts\", \"lines\": \"200-235\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01DPVC3tU3VRyuyjej85UqFn" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/leads-auth/index.ts\", \"lines\": \"540-595\"}">
</lov-tool-use>
Now let me check what's between `check_google_integrations` (line 1559) and the previous action — there must be a global gate above it that bounces non-listed actions, OR there's an unrecognized-action 400 at the end. Let me check around line 1500-1560 and the file's end.
<lov-tool-use id="toolu_vrtx_01VTTUfxUNtujKpR82dgAjpF" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/leads-auth/index.ts\", \"lines\": \"1490-1560\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01BmFmkwjUj5maajjLQjqbQw" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"supabase/functions/leads-auth/index.ts\", \"query\": \"Unknown action|Invalid action|Unrecognized\"}">
</lov-tool-use>
Got the picture. The `check_google_integrations` action body is syntactically clean and ends with a 200 — but it's at line 1559, near the **middle** of a 4577-line file. There's a **huge action router below it (lines 1622–4569)**. The 400 "Invalid action" only fires if no action matched.

Two possible scenarios:
1. The frontend is sending the wrong action name (typo / different casing)
2. There's a syntax error somewhere ABOVE line 1559 OR between 1559 and 4569 that breaks the entire file's parsing — causing the function to crash on EVERY request, then maybe surfacing as a different error (the user is calling it "400" but it could be 500 / network error / function failed to deploy).

Let me check the supabase linter and confirm the frontend invocation is using the correct action name.
<lov-tool-use id="toolu_vrtx_019jjgZfjQb5b2BHvyukJNYQ" name="supabase--linter" integration-id="supabase" data="">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Vx5zcCFjD634Hwhb8doQrF" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/Leads.tsx\", \"lines\": \"4250-4310\"}">
</lov-tool-use>
Frontend invocation is correct. The action name matches, and the action body is syntactically clean and always returns 200.

`supabase.functions.invoke` throws an `error` object whenever the function returns a non-2xx OR when there's a network/CORS issue. The user is interpreting that as "400" but it could be a deploy failure or a CORS/network issue.

I have enough to present a plan.

<lov-plan>

## Diagnosis: No syntax error exists

I read lines 1558-1621 of `supabase/functions/leads-auth/index.ts`. The `check_google_integrations` action is **syntactically clean**:
- `Record` type declaration is correct (line 1560)
- The GSC regex is intact: `/<meta[^>]+name=["']google-site-verification["'][^>]+content=["']([^"']+)["']/i` (line 1598) — no characters stripped
- Entire action wrapped in `try/catch` (lines 1561-1615)
- Always returns `200` with `{success: true, results}` (lines 1617-1620)
- Frontend invocation in `Leads.tsx` line 4275 uses the correct action name

The user's diagnosis ("syntax error stripping the regex") is incorrect — there's nothing to fix in the action body itself.

## Real likely causes of the 400

`supabase.functions.invoke` surfaces ANY non-2xx as a thrown `error`, which the toast labels generically. The actual cause is one of:

1. **Outbound `fetch` to `https://riversand.net/` is failing** — Deno edge runtime sometimes blocks/times-out on outbound calls to certain domains. The GSC block (line 1595) runs unconditionally on every call, even when `gsc_id` is empty. If that fetch hangs or throws synchronously before the inner try/catch (e.g. invalid URL parsing), it could cascade.
2. **Function failed to deploy** — last edit may have hit a transient deploy failure; the frontend is hitting an older bundle that doesn't have the action, hitting the fall-through `"Invalid action"` 400 at line 4567.
3. **Slow GMB/Clarity/GTM fetches** causing the function to exceed CPU/wall-time and return a platform-level 5xx (which `invoke` surfaces as a thrown error).

## Plan: pinpoint and fix without guessing

### Step 1 — Pull live evidence (no code changes)
- Call the deployed function directly with `supabase--curl_edge_functions` using the same payload the frontend sends. This shows the **actual HTTP status code and body** — confirming whether it's truly 400 (action mismatch / deploy stale), 500 (runtime crash), or a CORS/timeout.
- Pull edge logs via `supabase--edge_function_logs` filtered to `check_google_integrations`. The previous log query returned empty, suggesting either the function isn't being invoked at all OR is crashing before reaching the `console.log` calls.

### Step 2 — Apply targeted fix based on evidence

**If logs show "Invalid action" 400** → function is stale / bundle didn't redeploy. Trigger a redeploy with a no-op edit.

**If logs show runtime crash / timeout** → harden the action:
- Move the GSC `fetch("https://riversand.net/")` inside its own short-timeout `AbortController` (3s max)
- Skip the GSC fetch entirely when no GSC checks are pending
- Add `Promise.allSettled` parallelism so one slow check doesn't block the others

**If `curl` returns 200 but frontend sees error** → the issue is client-side (CORS, body shape, `data.results` undefined), not the edge function.

### Files modified (only after evidence is in)
- `supabase/functions/leads-auth/index.ts` — minimal hardening to lines 1558-1621 only

### Files NOT touched
- All other actions in `leads-auth/index.ts`
- Frontend `Leads.tsx` invocation
- `stripe-webhook`, `send-email`, `generate-city-page`, `pits.ts`, `create_order`

### What I will NOT do
- Blindly "fix syntax" that isn't broken
- Touch the regex (it's correct)
- Modify the `Record` type declaration (it's correct)
- Refactor logic the user explicitly said not to change

### Risk
- **LOW**: All proposed changes are scoped to one action block, additive defensive guards only.

