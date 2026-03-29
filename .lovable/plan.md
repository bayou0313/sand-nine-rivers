

## Delivery Leads Dashboard — Enhanced Table with Metrics, Filters, Search, Sort, Export & Pagination

### Overview
Rewrite `src/pages/Leads.tsx` to add summary metrics, search, filters, sortable columns, pagination, CSV export, and visual polish — all client-side on the already-loaded data.

---

### Data Parsing

Extract `state` and `zip` from each lead's `address` string using a regex parser (e.g., match `, ST XXXXX` pattern at end of address). Store parsed values in local component state alongside leads data.

---

### Step 1 — Summary Metrics Bar

Add a horizontal row of 7 metric cards between the header and the table:
- **Total Leads** — `leads.length`
- **Not Contacted** — count `contacted === false`
- **Contacted** — count `contacted === true`
- **This Month** — leads where `created_at` is in current calendar month
- **Avg Distance** — average of `distance_miles` (rounded to 1 decimal)
- **States** — count of distinct parsed states
- **ZIP Codes** — count of distinct parsed ZIP codes

Style: navy `#0D2137` card backgrounds, gold `#C07A00` numbers, white labels. Grid: 7 columns on desktop, 2 columns on mobile.

---

### Step 2 — Search Bar

Add a search `<Input>` above the table. Filters leads in real-time across address, name, email, phone. Includes a clear (X) button when text is present. Placeholder: "Search leads..."

---

### Step 3 — Filter Bar

Add filter dropdowns next to search:
- **Contacted status**: All / Not contacted / Contacted
- **State**: All states + dynamically populated from parsed lead states
- **Date range**: All time / Today / This week / This month / This year
- **Distance range**: All / 30–50 mi / 50–75 mi / 75–100 mi / 100+ mi

Use `<select>` elements styled with navy/gold theme.

---

### Step 4 — Sortable Table Columns

New columns: Lead # (row index), Date, Address, State, ZIP, Miles, Name, Email, Phone, Contacted.

Each column header is clickable. First click = ascending, second = descending. Show sort arrows (↑↓↕). Active sort column text highlighted in gold. Default sort: Date descending (newest first).

All sorting is client-side on the filtered dataset.

---

### Step 5 — Table Visual Enhancements

- **Alternating rows**: white / `#F9F9F9`
- **Hover**: light gold tint `#FFF8E7`
- **Contacted badge**: green pill "Contacted" / amber pill "Pending" (replaces icon)
- **Toggle** still works inline via badge click
- **Distance**: shown with "mi" suffix
- **Date format**: "Mar 29, 2026 10:43 AM"
- **Navy header row** with white text and gold sort indicators
- **Row count**: "Showing X of Y leads" below table
- **Pagination**: 25 per page, Previous/Next buttons, "Page X of Y"
- **Mobile**: horizontal scroll wrapper on small screens

---

### Step 6 — Export CSV Button

Add "Export CSV" button in the header area (top right, next to lead count). Exports the currently filtered/sorted leads as a CSV download. Columns: Lead #, Date, Address, State, ZIP, Miles, Name, Email, Phone, Contacted. Filename: `delivery-leads-YYYY-MM-DD.csv`. Uses client-side Blob download — no server call.

---

### Single File Changed

| File | Changes |
|---|---|
| `src/pages/Leads.tsx` | Complete rewrite of authenticated view: add metrics bar, search, filters, sortable columns, pagination, CSV export, visual styling |

