

Confirmed: existing settings save path handles `snapshot_pending_notes` automatically. No new action needed.

## Plan: `export_knowledge_snapshot` (locked)

### Files modified (2)
1. **`supabase/functions/leads-auth/index.ts`** — add `export_knowledge_snapshot` action case
2. **`src/pages/Leads.tsx`** — add export button + pending-notes textarea in Settings tab

### Database (1 migration)
Seed 5 keys in `global_settings`:
- `snapshot_version` = `'v1.00'`
- `snapshot_previous_length` = `'0'`
- `snapshot_version_history` = `'[]'`
- `snapshot_version_major_threshold` = `'0.15'`
- `snapshot_pending_notes` = `''`

### Schema (confirmed)
- `city_pages.status` text → `.eq("status", "active")`
- `pits.status` text → `.eq("status", "active")`
- `pits.operating_days` integer array → Saturday-only = `length===1 && [0]===6`
- Storage `assets` bucket public; service role bypasses RLS for upload

### Snapshot content
1. Header (version, timestamp, project IDs)
2. Pricing config
3. Active PITs table (rate column shows pit-level vs global source)
4. City pages (active count, pending regen)
5. Business profile
6. Activity (orders last 30 days)
7. **Pending / Known Issues** (verbatim from `snapshot_pending_notes`)
8. Stack info

### Version logic (mirrors docs generator)
- Build content → measure char length → diff vs `snapshot_previous_length`
- `changeRatio >= 0.15` → major bump (`v1.09` → `v2.01`); else minor
- Append history entry: version, prev, ratio, major flag, timestamp

### UI (Settings tab)
- **Pending Notes textarea**: bound to `snapshot_pending_notes`, flows through existing `saveGlobalSettings` handler — no new action
- **Export button**: "Export AI Snapshot (vX.XX)" — calls action, toasts version + change_ratio, opens public URL in new tab
- Both placed alongside existing "Generate & Download" button using brand-gold ghost styling

### Files NOT touched
- `generateProjectDocs.ts`, `docs_current_version` keys (independent system)
- All existing `leads-auth` actions (purely additive)
- stripe-webhook, send-email, generate-city-page, google-maps, pits.ts, create_order RPC

### Risk: LOW
- Additive edge function case (password-gated, read-only on data tables, write only to snapshot keys + storage)
- Separate version namespace — cannot collide with v1.xx doc generator
- Reuses existing settings save handler

### Post-deploy verification
1. `/leads` → Settings → enter pending note → save (uses existing handler)
2. Click "Export AI Snapshot (v1.00)" → toast confirms `v1.01`, file opens in new tab
3. Verify markdown contains: pricing, PIT table with rate-source indicators, city counts, **Pending / Known Issues block with note text**, stack
4. Click again → bumps to `v1.02` (minor, expected)
5. Confirm `snapshot_version` and history updated in `global_settings`
6. Confirm existing "Generate & Download" button still works independently

