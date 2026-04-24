# Riversand.net Form Guidelines v1.1

_Canonical reference for all customer-facing and operator-facing forms (riversand.net Order checkout + LMT operator panels). Audited from `src/pages/Order.tsx`, `src/pages/OrderMobile.tsx`, `src/components/EmailInput.tsx`, `src/lib/format.ts`, `src/lib/textFormat.ts`. Read-only audit, 2026-04-24._

**Version:** 1.1 (2026-04-24)

**Changelog:**
- **1.1 (2026-04-24)** — Added Section 12: Case handling per field (definitive table). Flagged DriverModal `formatEmail` wrapper gap as known follow-up.
- **1.0 (2026-04-24)** — Initial canonical document.

---

## 1. Form state model

- **Single `useState` object** for the whole form (`form`, with fields like `name`, `companyName`, `phone`, `email`, `notes`). Updates use spread: `setForm({ ...form, name: ... })`. Not react-hook-form, not zod (those exist in deps but checkout uses plain state).
- **`formAttempted: boolean`** flag (separate `useState`), flipped to `true` only when the user clicks the primary submit button while the form is invalid.
- An effect resets `formAttempted` back to `false` once `isFormValid` becomes true — so red borders disappear as soon as the user fixes the issue.

```ts
useEffect(() => { if (isFormValid) setFormAttempted(false); }, [isFormValid]);
```

- **`isFormValid`** is a derived `const`, not state:

```ts
const isFormValid = selectedDeliveryDate && form.name.trim() && form.phone.trim() && form.email.trim();
```

- Submit button click handler: `if (!isFormValid) { setFormAttempted(true); return; } else proceed();`
- Field-level validation does **not** fire on blur or on change. Only on submit attempt. Inline transformations (mask/title-case) happen on change/blur, but error states do not.

---

## 2. Field-by-field spec (desktop = `Order.tsx`)

All labels share this exact pattern:

```tsx
<label className="font-body text-sm text-muted-foreground uppercase tracking-wider mb-1.5 block">
  LABEL TEXT *
</label>
```

> **Note on label sizing drift:** Order.tsx desktop uses `text-sm` + `mb-1.5`. OrderMobile and the LMT dashboards use `text-xs` + `mb-1`. **Both are valid and in active use**:
>
> - **Customer-facing checkout (desktop):** `text-sm mb-1.5`
> - **Mobile checkout + all LMT operator forms:** `text-xs mb-1`
>
> Use `text-xs mb-1` for any new operator/admin form (Drivers, Schedule, etc). Use `text-sm mb-1.5` only inside customer checkout flows.

### 2.1 Name (Full Name)

```tsx
<Input
  type="text"
  name="name"
  autoComplete="name"
  maxLength={100}
  required
  value={form.name}
  onChange={(e) => setForm({ ...form, name: formatProperName(e.target.value) })}
  onBlur={(e)   => setForm({ ...form, name: formatProperNameFinal(e.target.value) })}
  className={`h-[52px] rounded-lg text-base ${
    formAttempted && !form.name.trim() ? "border-destructive border-2" : ""
  }`}
/>
```

- `formatProperName` (real-time, lighter touch — capitalizes words as the user types).
- `formatProperNameFinal` (on blur, applies stricter normalization — e.g. fixes "MCDONALD" → "McDonald").

### 2.2 Company Name (optional)

Same as Name, but `name="companyName"`, `autoComplete="organization"`, `placeholder="Optional"`, no `required`, no error styling.

### 2.3 Phone

```tsx
<Input
  type="tel"
  inputMode="tel"
  name="phone"
  autoComplete="tel"
  maxLength={14}
  required
  value={form.phone}
  onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
  className={`h-[52px] rounded-lg text-base ${
    formAttempted && !form.phone.trim() ? "border-destructive border-2" : ""
  }`}
/>
```

- **Display = formatted** `(555) 555-5555` via `formatPhone()` from `src/lib/format.ts`.
- **Storage = digits only** via `stripPhone()` — applied at the moment of building the DB payload, NOT in state. The form state always holds the formatted string. This is intentional — keeps display consistent on re-render.
- `formatPhone` truncates to 10 digits internally; combined with `maxLength={14}` you cannot enter more than a US-format phone. **No country-code handling — US-only assumption.**

### 2.4 Email — always via `<EmailInput>`

```tsx
<EmailInput
  name="email"
  value={form.email}
  onChange={(v) => setForm({ ...form, email: formatEmail(v) })}
  required
  className={`h-[52px] rounded-lg text-base ${
    formAttempted && !form.email.trim() ? "border-destructive border-2" : ""
  }`}
/>
```

`EmailInput` (`src/components/EmailInput.tsx`) is a thin wrapper around shadcn `<Input>`. It:

- Hard-sets `type="email"` and `autoComplete="email"`.
- Defaults `maxLength={255}`, `placeholder="john@example.com"`.
- Exposes a value-based `onChange(value: string)` (not the event) and a value-based `onBlur(value: string)`.
- Does **not** do its own validation, sanitization, lowercasing, or autocapitalize handling.

> **Gotchas / known gaps in EmailInput:**
>
> - It does not set `inputMode="email"` (mobile keyboard is determined by `type="email"` only — works in practice but explicit `inputMode` would be belt-and-suspenders).
> - It does not set `autoCapitalize="none"` or `autoCorrect="off"` or `spellCheck={false}` — iOS Safari can capitalize the first letter of an email. The mitigation is the wrapping `formatEmail(v)` transform in checkout (lowercases + trims). **New consumers MUST also pipe through `formatEmail` or implement their own lowercase step.** (See Section 12 for the definitive case rules.)

### 2.5 Notes / Delivery Instructions (Textarea)

```tsx
<Textarea
  name="notes"
  rows={2}
  maxLength={275}
  value={form.notes}
  onChange={(e) => setForm({ ...form, notes: formatSentence(e.target.value) })}
  className="rounded-lg text-base"
/>
<p className="text-xs text-muted-foreground mt-1 text-right font-body">
  {form.notes.length}/275
</p>
```

- `rows={2}` always. No vertical resize disabled programmatically — relies on shadcn default.
- Live counter `n/MAX` aligned right, `text-xs text-muted-foreground font-body`.
- `formatSentence` capitalizes the first letter of each sentence.
- **maxLength convention:** `275` for customer delivery instructions (truck driver readability), `1000` for operator/admin notes (more context, no SMS preview constraint).

### 2.6 Date input

Not a raw `<input type="date">` — checkout uses a custom `DeliveryDatePicker` component. For generic date fields elsewhere, use `<Input type="date" className="h-11 rounded-lg" />`.

### 2.7 Number input

```tsx
<Input type="number" step="0.01" min="0" value={...} onChange={...} className="h-11 rounded-lg" />
```

Always include `min` and `step`. No `max` unless business rule requires it.

### 2.8 Select (dropdown)

**Always shadcn `<Select>`**. Never native `<select>`. Use the `INPUT_CLS` (`h-11 rounded-lg`) on the trigger:

```tsx
<Select value={form.x} onValueChange={(v) => update("x", v as XType)}>
  <SelectTrigger className="h-11 rounded-lg"><SelectValue /></SelectTrigger>
  <SelectContent>
    {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
  </SelectContent>
</Select>
```

---

## 3. Mobile-specific overrides (`OrderMobile.tsx`)

OrderMobile inherits everything above with deliberate departures:

1. **Larger inputs:** `h-16 rounded-xl text-lg placeholder:text-black/35` (vs desktop `h-[52px] rounded-lg text-base`). Bigger touch targets, larger text.
2. **`enterKeyHint="next"`** on every non-final field, plus a manual `onKeyUp` handler that focuses the next field's `ref` when Enter is pressed.
3. **Visual-viewport scroll handling:** every input has an `onFocus` handler that runs `el.scrollIntoView({ behavior: 'smooth', block: 'center' })` after 300 ms — works around the iOS soft-keyboard pushing fields off-screen.
4. **Auto-advance to next field** when phone reaches 14 chars (full mask): synthetic focus on the email input. Pattern is checkout-specific, not required for operator forms.
5. The whole block is wrapped in `<form autoComplete="on" onSubmit={e => e.preventDefault()}>` so iOS treats it as a single coherent autofill scope.
6. Optional fields (Company, Notes) are collapsed behind a `+ Add …` link instead of always-visible — reduces mobile cognitive load.

---

## 4. Validation pattern — definitive

| When | What happens |
|---|---|
| User types | `onChange` runs format transforms (mask/title-case/lowercase). **No validation.** |
| User blurs a field | Text-format finalization (e.g. `formatProperNameFinal`) on Name. **No validation.** |
| User clicks primary submit while invalid | `setFormAttempted(true)`. Required fields with empty `.trim()` get `border-destructive border-2`. Submit handler returns early. |
| User fixes the field | Effect detects `isFormValid === true` and clears `formAttempted` → red borders disappear. |
| User submits with valid client state but server rejects | Inline error (e.g. duplicate phone 409 → `setPhoneError("…already exists")`) **OR** toast for transport errors. Inline preferred when the error is actionable on a specific field. |

**Helper text styling** (when used — required fields use border-only; specific errors use border + helper):

```tsx
<div className="flex items-center gap-1 mt-1 text-xs" style={{ color: "#DC2626" }}>
  <AlertCircle className="w-3 h-3" />
  {errorMessage}
</div>
```

**Form-level error summary** (only on submit attempt with invalid state):

```tsx
{!isFormValid && (
  <p className="font-body text-xs text-destructive text-center">
    Please fill in all required fields above.
  </p>
)}
```

Rendered just below the submit button.

**No `aria-live`, no `aria-invalid`, no `aria-describedby`, no auto-focus on first error field** in the current codebase. This is a known a11y gap. Recommended for v1.2 but not required for parity with current forms.

---

## 5. Submit button pattern

```tsx
<Button
  onClick={() => {
    if (!isFormValid) { setFormAttempted(true); return; }
    handleSubmit();
  }}
  disabled={submitting || !termsAccepted /* + any business gates */}
  className="w-full h-14 font-display tracking-wider text-lg bg-accent hover:bg-accent/90
             rounded-2xl shadow-lg shadow-accent/20 transition-all duration-300 disabled:opacity-40"
>
  {submitting
    ? <Loader2 className="w-5 h-5 animate-spin" />
    : <><Lock className="w-4 h-4 mr-2" /> SUBMIT</>}
</Button>
```

Rules:

- **Disabled** for transport in-flight (`submitting`) and for unmet business gates (terms, payment confirmed, etc).
- **NOT disabled** for `formAttempted && hasErrors` — leave it clickable so the click can flip `formAttempted` and reveal red borders. This is intentional UX.
- **Spinner:** always `<Loader2 className="w-5 h-5 animate-spin" />` from `lucide-react`. No text change ("Saving…") in checkout — spinner replaces the entire label.
- **Operator/LMT variant:** smaller button, spinner inline with text: `{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save`.

---

## 6. Visual / token reference

| Token | Value | Where |
|---|---|---|
| Label color | `text-muted-foreground` (HSL var) | All labels |
| Label font | `font-body` (Inter) | All labels |
| Label size | `text-sm` (desktop checkout) / `text-xs` (mobile + operator) | — |
| Label transform | `uppercase tracking-wider` | Always |
| Label spacing | `mb-1.5 block` (checkout) / `mb-1 block` (operator) | — |
| Error color | `border-destructive` (token) and `#DC2626` (literal) | Both acceptable; prefer token in customer flows, literal hex in operator dashboards which override Tailwind tokens for brand consistency. |
| Input height | `h-[52px]` (desktop checkout), `h-16` (mobile checkout), `h-11` (operator main), `h-9` (operator compact) | — |
| Input radius | `rounded-lg` (desktop + operator), `rounded-xl` (mobile) | — |
| Input text size | `text-base` (desktop), `text-lg` (mobile), default (operator) | — |
| Input bg | `bg-background` (shadcn default) | — |
| Focus ring | shadcn default `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` | Don't override |
| Section heading | `font-display tracking-wider text-2xl` (checkout) / `font-display uppercase tracking-wide` (operator dialogs) | — |
| Brand navy | `#0D2137` (literal in operator) | Section headings in dialogs |
| Brand gold | `#C07A00` (literal in operator) | Primary save button bg in operator |
| Error red literal | `#DC2626` | Operator inline error text |

---

## 7. Layout patterns

- **Field pairs:** desktop checkout uses `grid grid-cols-1 sm:grid-cols-2 gap-3`. Operator dialogs use `grid grid-cols-2 gap-3` (no responsive collapse — modals are constrained width).
- **Vertical spacing between groups:** `space-y-3` inside a section, `space-y-4` or `space-y-6` between sections.
- **Section heading:** icon-in-rounded-square + uppercase text, see `SectionHeading` helper in Order.tsx (lines 1438–1445).
- **Wrap the whole form** in `<form autoComplete="on" onSubmit={e => e.preventDefault()}>` for mobile autofill grouping. (Desktop checkout omits this — autofill works field-by-field via `autoComplete` attrs alone.)

---

## 8. Format transform reference (`src/lib/format.ts` + `src/lib/textFormat.ts`)

| Function | Use case | Trigger |
|---|---|---|
| `formatPhone(v)` | Mask raw input → `(555) 555-5555`, truncate to 10 digits | `onChange` |
| `stripPhone(v)` | Strip mask → digits only | At payload-build time before save |
| `formatProperName(v)` | Real-time title-case as user types | `onChange` |
| `formatProperNameFinal(v)` | Final normalization (handles "Mc", "O'", etc) | `onBlur` |
| `formatSentence(v)` | Capitalize first letter of each sentence | `onChange` (notes) |
| `formatEmail(v)` | Lowercase + trim | `onChange` and `onBlur` (mandatory wrapper for EmailInput due to iOS autocapitalize) |
| `formatCurrency(n)` | `$1,234.56` | Display-only, never on input |

---

## 9. Server-side validation contract

- All form data is re-validated server-side (edge functions: `leads-auth` validators, `create_order` RPC).
- Phone is stored as **digits only** in the DB. Display formatting happens at read time via `formatPhone()`.
- Email is stored **lowercased + trimmed**.
- Names are stored as the user-typed-then-blur-normalized string. Server does not re-title-case.
- Notes are stored as-is (server may have its own length cap; LMT operator notes are capped at 1000 in DB validators per Phase 0 driver work).

---

## 10. Accessibility gaps to address in v1.2 (not blockers)

- No `aria-invalid={true}` on errored inputs.
- No `aria-describedby` linking the helper text to its input.
- No `aria-live="polite"` region for the form-level error summary.
- No auto-focus on the first invalid field after a failed submit.
- Operator `Active` toggle uses a `<Label>` next to a `<Switch>` but no `aria-labelledby` linkage (Radix handles this internally — verified OK).

These should be added as a single sweep across all forms in a future polish pass; do not block Phase 3 on them.

---

## 11. Phase 3 driver portal — direct application

For the driver portal, follow the **operator track** (not the customer-checkout track):

- Labels: `font-body text-xs text-muted-foreground uppercase tracking-wider mb-1 block`
- Inputs: `h-11 rounded-lg`
- Email: `<EmailInput>` always, wrap `onChange` with `formatEmail` (mandatory — prevents iOS autocapitalize)
- Phone: `type="tel"`, `inputMode="tel"`, `autoComplete="tel"`, `maxLength={14}`, format with `formatPhone` on change, strip with `stripPhone` at save time
- Validation: `formAttempted` flag, red border + `#DC2626` inline helper on submit-attempt
- Submit: `<Loader2 />` spinner, disable on `saving`, do not disable on validity errors
- Select: shadcn `<Select>`, never native
- Notes: `rows={2}`, `maxLength={1000}`
- Case rules: see Section 12 for definitive per-field case handling.

---

## 12. Case handling per field — definitive

| Field | Case rule | How it's enforced | Notes |
|---|---|---|---|
| **Name / Full Name** | Title Case (e.g. `John McDonald`) | `formatProperName` on `onChange` (light touch), `formatProperNameFinal` on `onBlur` (handles `Mc`, `Mac`, `O'`, hyphenates, fixes ALL-CAPS input) | User can type any case; output is always normalized. iOS auto-cap of first letter is desired here, so no `autoCapitalize` override. |
| **Company Name** | Title Case | Same: `formatProperName` + `formatProperNameFinal` | Same as Name. |
| **Phone** | n/a (digits + punctuation only) | `formatPhone` strips non-digits | No letters allowed. |
| **Email** | **lowercase + trim** | `formatEmail(v)` wrapper on `onChange` and `onBlur` of `<EmailInput>` | **Mandatory wrapper.** EmailInput itself does NOT lowercase. iOS Safari autocaps the first letter of an email — `formatEmail` is the only line of defense. New consumers MUST wrap onChange with `formatEmail`. |
| **Notes / Delivery Instructions** | Sentence case (capitalize first letter of each sentence) | `formatSentence` on `onChange` | User can type lowercase; output capitalizes after `.`, `!`, `?`. Preserves the rest of the user's casing. |
| **Address** | As returned by Google Places (mixed case, properly formatted) | No transform — Google's `formatted_address` is authoritative | Don't title-case or lowercase address strings. |
| **Operator-only fields** (Truck Number, Driver Notes, etc.) | **No transform** — preserve user input as-typed | n/a | Truck numbers may legitimately be `T-101`, `t101`, or `TRUCK-A`. Operator forms should NOT auto-format text fields unless there's a domain rule. |

### iOS-specific rules

`<EmailInput>` does NOT currently set `autoCapitalize="none"`, `autoCorrect="off"`, or `spellCheck={false}`. The reliance is entirely on the `formatEmail` wrapper. **Two implications:**

1. If a future consumer uses `<EmailInput>` without wrapping `onChange` in `formatEmail`, they'll silently ship a bug where `John@example.com` is stored uppercase-J.
2. A v1.2 hardening pass should bake `autoCapitalize="none"` + `autoCorrect="off"` + `spellCheck={false}` directly into `EmailInput` so wrappers become defense-in-depth, not the only defense.

### Storage normalization (server-side)

- **Email** — stored lowercased + trimmed (client transforms before send; server validators re-apply for safety).
- **Phone** — stored as digits only via `stripPhone()` at payload-build time. Display reformats via `formatPhone()` on read.
- **Names** — stored as user-typed-then-blur-normalized. Server does not re-title-case.
- **Notes** — stored as-is.

### Phase 3 driver portal — case rules

- Driver `name` → use `formatProperName` + `formatProperNameFinal` (same as customer).
- Driver `email` → `<EmailInput>` + wrap onChange with `formatEmail`. **Currently missing in DriverModal** — it pipes raw `v` straight into state. That's a real gap. Recommended 1-line fix before Phase 3 starts so the pattern is exemplary.
- Driver `truck_number`, `notes` → no transform.
- Driver `phone` → `formatPhone` on change, `stripPhone` at save (already correct in DriverModal).

---

## Known follow-ups (carried forward)

| Item | Severity | Tracked in |
|---|---|---|
| DriverModal `EmailInput.onChange` does not wrap with `formatEmail` | Low (cleanup) | Phase 1 cleanup pass — apply before Phase 3 |
| `EmailInput` itself missing `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}` | Low (defense-in-depth) | v1.2 hardening pass |
| No `aria-invalid`, `aria-describedby`, `aria-live` on errored fields | Medium (a11y) | v1.2 hardening pass |
| No auto-focus on first error field after failed submit | Low (UX polish) | v1.2 hardening pass |

---

## Version Gate Protocol

Every Lovable session that touches a form in riversand.net must, before its first edit:

1. Confirm it has read this file at version **1.1 (2026-04-24)** or newer.
2. If a newer `RIVERSAND_FORM_GUIDELINES_vX.Y_YYYY-MM-DD.md` exists in the repo, read it instead and report the version.
3. Restate which track the form belongs to (customer checkout vs operator/mobile) and apply the corresponding sizing tokens (Section 2 + Section 6).
4. Reference Section 11 (Phase 3 direct application) and Section 12 (case handling) for any driver portal work.

---

_Source: Order.tsx (1772–1789, 84, 1431–1435, 2084–2103), OrderMobile.tsx (1300–1430), EmailInput.tsx (full), format.ts (2–13), textFormat.ts (10–59)._
