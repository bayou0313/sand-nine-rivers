# LMT Dashboard — UI/UX Design System
## riversand.net / WAYS® | Version 1.0 | April 2026

> **Purpose:** This document is the single source of truth for all UI patterns in the `/leads` LMT dashboard. Every tab, card, table, and interactive element must follow these rules. The Live Visitors tab is the reference implementation.

---

## 1. Brand Constants

These must be imported at the top of every tab component. Never use raw hex values anywhere except these declarations.

```typescript
const BRAND_NAVY  = "#0D2137";
const BRAND_GOLD  = "#C07A00";
const POSITIVE    = "#059669";
const ALERT_RED   = "#DC2626";
const WARN_YELLOW = "#D97706";

const T = {
  cardBg:      "#FFFFFF",
  cardBorder:  "#E5E7EB",
  textPrimary: "#111827",
  textSecond:  "#6B7280",
  pageBg:      "#F9FAFB",
};
```

---

## 2. Typography

| Use | Font | Size | Weight | Color |
|-----|------|------|--------|-------|
| Section labels | `font-display` (Bebas Neue) | `text-sm` | uppercase + tracking-wide | `T.textPrimary` |
| Body text | `font-sans` (Inter) | `text-sm` | 400 | `T.textPrimary` |
| Muted/secondary | `font-sans` | `text-xs` | 400 | `T.textSecond` |
| Metric numbers | `font-sans` | `text-2xl` | 600 | contextual |
| Order numbers | `font-sans` | `text-sm` | 600 | `BRAND_GOLD` + tabular-nums |

**Rules:**
- Never use DM Sans
- All-caps section headers use `font-display`
- Numbers in metrics always use `fontVariantNumeric: 'tabular-nums'`

---

## 3. Page Shell

Every tab renders inside this shell. Never modify the header or shell structure.

```tsx
<div className="min-h-screen" style={{ backgroundColor: T.pageBg }}>
  <header className="border-b" style={{ backgroundColor: BRAND_NAVY, borderColor: BRAND_NAVY }}>
    <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
      <h1 className="text-white font-display text-2xl tracking-wide">RIVERSAND LMT</h1>
      <button onClick={logout} className="text-white/80 hover:text-white text-sm">Sign out</button>
    </div>
  </header>
  <main className="max-w-7xl mx-auto px-6 py-6">{children}</main>
</div>
```

---

## 4. Tab Header Pattern (Live Visitors reference)

Every tab must open with this structure: a live indicator (if real-time), a count label, and a refresh/action button on the right.

```tsx
<div className="flex items-center justify-between mb-4">
  <div className="flex items-center gap-2">
    {/* Pulsing dot — use for real-time tabs */}
    <span className="relative flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
    </span>
    <p className="text-sm" style={{ color: T.textSecond }}>
      {count} records (last 30 min)
    </p>
  </div>
  <Button onClick={fetchData} disabled={loading} size="sm" variant="outline">
    {loading
      ? <Loader2 className="w-4 h-4 animate-spin mr-1" />
      : <RefreshCw className="w-4 h-4 mr-1" />}
    Refresh
  </Button>
</div>
```

**Rules:**
- Pulsing green dot = live/real-time data
- Static gray dot = periodic refresh (30s, 60s)
- No dot = manual refresh only
- Refresh button always top-right, always shows spinner when loading
- Count label always shows actual number — never "Loading..."

---

## 5. Metric Cards (4-up grid)

Used at the top of every tab that has summary stats.

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
  {metrics.map(m => (
    <div key={m.label} className="rounded-xl border p-5"
      style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
      <div className="text-xs font-medium uppercase tracking-wider mb-1"
        style={{ color: T.textSecond }}>{m.label}</div>
      <div className="text-2xl font-semibold"
        style={{ color: m.color || T.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
        {loading ? '—' : m.value}
      </div>
      {m.sub && (
        <div className="text-xs mt-1" style={{ color: T.textSecond }}>{m.sub}</div>
      )}
    </div>
  ))}
</div>
```

**Rules:**
- Always show `—` while loading — never `0` or empty
- Use `POSITIVE` (#059669) for positive money/growth values
- Use `ALERT_RED` for negative/critical values
- Use `BRAND_GOLD` for conversion/revenue primary metrics
- 4 columns on desktop, 2 on tablet, 1 on mobile

---

## 6. Card Container

All content sections live inside this card.

```tsx
<div className="rounded-xl border shadow-sm p-6 mb-6"
  style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
  <h3 className="font-display uppercase tracking-wide text-sm mb-4"
    style={{ color: T.textPrimary }}>
    Section Title
  </h3>
  {/* content */}
</div>
```

---

## 7. Status Pills

```tsx
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending:   { bg: '#F3F4F6', text: '#6B7280' },
  confirmed: { bg: '#EFF6FF', text: '#3B82F6' },
  cancelled: { bg: '#FEF2F2', text: '#EF4444' },
  paid:      { bg: '#ECFDF5', text: '#059669' },
  captured:  { bg: '#ECFDF5', text: '#059669' },
  en_route:  { bg: '#EFF6FF', text: '#3B82F6' },
  delivered: { bg: '#ECFDF5', text: '#059669' },
  cod:       { bg: '#FDF8F0', text: '#C07A00' },
  active:    { bg: '#ECFDF5', text: '#059669' },
  inactive:  { bg: '#F3F4F6', text: '#6B7280' },
  draft:     { bg: '#F3F4F6', text: '#6B7280' },
  new:       { bg: '#F3F4F6', text: '#0D2137' },
  called:    { bg: '#EFF6FF', text: '#1A6BB8' },
  quoted:    { bg: '#FDF8F0', text: '#F59E0B' },
  won:       { bg: '#ECFDF5', text: '#22C55E' },
  lost:      { bg: '#F3F4F6', text: '#999999' },
};

function StatusPill({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.new;
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: c.bg, color: c.text }}>
      {status}
    </span>
  );
}
```

---

## 8. Visitor/Session Stage Colors (Live Visitors pattern)

For any funnel stage visualization:

```typescript
const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  visited:          { label: "Browsing",        color: "#9CA3AF" },
  entered_address:  { label: "Entered Address", color: "#3B82F6" },
  got_price:        { label: "Got Price",        color: "#F59E0B" },
  started_checkout: { label: "At Checkout",      color: "#EA580C" },
  reached_payment:  { label: "At Payment",       color: "#DC2626" },
  completed_order:  { label: "Converted",        color: "#22C55E" },
};
```

---

## 9. Loading States

```tsx
// Full-tab loader
if (loading) return (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="animate-spin" style={{ color: BRAND_GOLD }} size={32} />
    <span className="ml-3" style={{ color: T.textSecond }}>Loading...</span>
  </div>
);

// Card skeleton (3 placeholder cards)
{loading && Array.from({ length: 3 }).map((_, i) => (
  <div key={i} className="rounded-xl border p-5 animate-pulse"
    style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
    <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
    <div className="h-7 w-16 bg-gray-200 rounded" />
  </div>
))}
```

**Rules:**
- Always `Loader2` from lucide-react with `animate-spin` and `BRAND_GOLD`
- Never show `0` stats while loading — show `—`
- Disable all inputs and show spinner in submit buttons during save operations

---

## 10. Empty States

```tsx
{!loading && rows.length === 0 && (
  <div className="rounded-xl border p-12 text-center"
    style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
    <div className="text-4xl mb-2">📭</div>
    <p className="font-medium" style={{ color: T.textPrimary }}>No records yet</p>
    <p className="text-xs mt-1" style={{ color: T.textSecond }}>
      They'll appear here as soon as they come in.
    </p>
  </div>
)}
```

---

## 11. Tables

```tsx
<div className="overflow-x-auto rounded-xl border"
  style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
  <table className="min-w-full text-sm">
    <thead className="sticky top-0" style={{ backgroundColor: '#F9FAFB' }}>
      <tr>
        {cols.map(c => (
          <th key={c} className="px-4 py-3 text-left font-medium text-xs uppercase tracking-wider"
            style={{ color: T.textSecond }}>{c}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {rows.map((r, i) => (
        <tr key={r.id}
          className="border-t hover:bg-gray-50 transition-colors cursor-pointer"
          style={{ borderColor: T.cardBorder, backgroundColor: i % 2 === 0 ? T.cardBg : '#FAFAFA' }}>
          {/* cells */}
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

**Rules:**
- Sticky header always `#F9FAFB`
- Alternating row backgrounds (white / `#FAFAFA`)
- Hover state: `hover:bg-gray-50`
- Horizontal scroll on overflow — never break layout
- Column headers: uppercase, xs, tracked, `T.textSecond`

---

## 12. Buttons

```tsx
// Primary (BRAND_GOLD) — save, confirm, export
<button className="px-5 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
  style={{ backgroundColor: BRAND_GOLD }}>
  {loading ? <Loader2 className="animate-spin" size={14} /> : "Save"}
</button>

// Secondary (outline) — cancel, secondary actions
<button className="px-4 py-2 rounded-lg text-sm font-medium"
  style={{ border: `1px solid ${T.cardBorder}`, color: T.textPrimary, backgroundColor: T.cardBg }}>
  Cancel
</button>

// Destructive — delete, cancel order
<button className="px-4 py-2 rounded-lg text-sm font-medium text-white"
  style={{ backgroundColor: ALERT_RED }}>
  Delete
</button>

// Ghost icon button — inline actions (refresh, link, edit)
<button className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
  style={{ color: T.textSecond }}>
  <RefreshCw size={14} />
</button>
```

---

## 13. Search / Filter Bar (sticky)

```tsx
<div className="sticky top-0 z-10 -mx-6 px-6 py-3 mb-4 border-b"
  style={{ backgroundColor: T.cardBg, borderColor: T.cardBorder }}>
  <div className="flex items-center gap-3">
    <Search size={16} style={{ color: T.textSecond }} />
    <input
      value={query}
      onChange={e => setQuery(e.target.value)}
      placeholder="Search…"
      className="flex-1 outline-none text-sm bg-transparent"
      style={{ color: T.textPrimary }}
    />
    {query && (
      <button onClick={() => setQuery("")}>
        <X size={14} style={{ color: T.textSecond }} />
      </button>
    )}
  </div>
</div>
```

---

## 14. Action Menus (row-level)

```tsx
<DropdownMenu>
  <DropdownMenuTrigger>
    <MoreVertical size={16} style={{ color: T.textSecond }} />
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={resend}>Resend confirmation</DropdownMenuItem>
    <DropdownMenuItem onClick={cancel} className="text-red-600">Cancel order</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## 15. Time Display (Live Visitors pattern)

```typescript
const timeAgo = (iso: string): string => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
};
```

---

## 16. Auto-refresh Intervals by Tab

| Tab | Interval | Trigger |
|-----|----------|---------|
| Live Visitors | 30s | `setInterval` on tab enter |
| Orders | 60s | `setInterval` on tab enter |
| Abandoned Sessions | manual | Refresh button only |
| City Pages | manual | Refresh button only |
| Overview | 60s | On tab enter |
| Finances | manual | Refresh button only |

---

## 17. Toasts

```typescript
import { useToast } from "@/hooks/use-toast";
const { toast } = useToast();

// Success
toast({ title: "Saved", description: "Settings updated." });

// Error
toast({ title: "Error", description: err.message, variant: "destructive" });

// Info with context
toast({ title: `Exported — ${version}`, description: fileName });
```

**Rules:**
- Position: top-right (sonner default)
- Never block UI interactions
- Always include descriptive text on errors
- Success toasts: 2-3 seconds max

---

## 18. Form Validation

- Red border (`border-red-400`) on invalid fields
- Helper text below in `text-xs text-red-500`
- Trigger validation only after first submit attempt (`formAttempted` pattern)
- Disable submit while saving — show spinner inline in button

---

## 19. Modals / Dialogs

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-2xl p-6">
    <DialogHeader>
      <DialogTitle className="font-display uppercase tracking-wide">
        Modal Title
      </DialogTitle>
    </DialogHeader>
    {/* content */}
    <DialogFooter className="mt-6 flex justify-end gap-2">
      <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      <Button style={{ backgroundColor: BRAND_GOLD, color: "white" }}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## 20. Responsive Breakpoints

- Mobile-first always
- `md:` (≥768px) for 2-up grids
- `lg:` (≥1024px) for 4-up grids
- Sticky elements collapse on mobile
- Tables always horizontal-scroll — never break or wrap on mobile

---

## 21. What NOT To Do

| ❌ Never | ✅ Instead |
|---------|-----------|
| Raw hex colors in JSX | Use `BRAND_NAVY`, `T.cardBg`, etc. |
| DM Sans font | Inter (`font-sans`) |
| Show `0` while loading | Show `—` |
| Inline `style="color: #333"` | Use token: `T.textPrimary` |
| Fixed modals | Dialog component with `max-w-2xl` |
| Skip loading state | Always show `Loader2` while fetching |
| Skip empty state | Always show `📭` empty state |
| Hardcoded column widths | Use Tailwind responsive grid |
| Stack actions in text | Use `DropdownMenu` for 3+ actions |

---

## 22. Tab Compliance Checklist

Before shipping any new tab or major tab update, verify:

- [ ] Tab header has count label + refresh button
- [ ] Metric cards show `—` while loading
- [ ] Table has sticky header, alternating rows, hover state
- [ ] Empty state has 📭 icon + message
- [ ] Loading state uses `Loader2` with `BRAND_GOLD`
- [ ] All colors use brand tokens (no raw hex in JSX)
- [ ] Toasts on all save/error paths
- [ ] Mobile: table horizontally scrolls
- [ ] Auto-refresh interval set per Section 16 table

---

*Document maintained by: CMO/Coder session | Update this file after any design system changes.*
