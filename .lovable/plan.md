

## Consolidated Implementation Plan — All Pending Instructions

Here's everything that still needs to be implemented, gathered from all approved but unexecuted plans:

---

### 1. Remove WhatsApp from Desktop Screens
**File: `src/components/WhatsAppButton.tsx`**
- Desktop toggle: `message ↔ phone` only (no WhatsApp)
- Mobile toggle: `whatsapp ↔ phone` only
- Guard: if viewport changes to desktop while mode is `whatsapp`, auto-switch to `message`

### 2. Move Floating Button to Right Side
**File: `src/components/WhatsAppButton.tsx`**
- Line 174: `left-6` → `right-6`, `items-start` → `items-end`
- Line 310: Label positioning `left-14` → `right-14`, animation `x: -10` → `x: 10`

### 3. Button Hover Animations
**File: `src/components/ui/button.tsx`**
- Replace `transition-colors` with `transition-all duration-200`
- Default variant: add `hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0`
- Outline variant: add `hover:border-accent hover:shadow-md`

### 4. Contact / Footer Visual Separation
**File: `src/components/ContactForm.tsx`**
- Add accent divider at bottom of section (thin `border-accent/30` strip)

**File: `src/components/Footer.tsx`**
- Add `pt-10` and a `bg-accent/20 h-px` divider at top for clear separation

### 5. Phone Number Mask — Site-Wide
**File: `src/components/ContactForm.tsx`**
- Import `formatPhone` from `@/lib/format`, apply to phone input onChange

**File: `src/components/WhatsAppButton.tsx`**
- Import `formatPhone`, apply to callback form phone input

### 6. Email Mandatory on Orders + Validation + Autocomplete
**File: `src/components/EmailInput.tsx`** (new)
- Reusable email input with domain autocomplete suggestions (gmail.com, yahoo.com, aol.com, outlook.com, hotmail.com, icloud.com)
- Dropdown appears when user types `@`, filters as they type after `@`

**File: `src/pages/Order.tsx`**
- Email field: change label to "Email *", add `required`, add regex validation
- Update `isFormValid` (line 464) to require `form.email.trim()`
- Use `EmailInput` component for the email field

**File: `src/components/ContactForm.tsx`**
- Use `EmailInput` component for the email field

### 7. Sticky Checkout Timeline
**File: `src/pages/Order.tsx`**
- Wrap CountdownBar + progress steps in `sticky top-16 z-40 bg-background/95 backdrop-blur-md` container
- Subtle bottom border when scrolled

### 8. Darker Muted Text — Site-Wide Readability
**File: `src/index.css`**
- Change `--muted-foreground: 209 30% 40%` → `--muted-foreground: 209 40% 25%`
- Increases contrast from ~3.5:1 to ~7:1 (WCAG AAA)

### 9. Back Button on Checkout Step 1
**File: `src/pages/Order.tsx`**
- Add `← BACK TO HOME` link button (using `Link to="/"`) below address form in Step 1

---

### Files touched (summary)
| File | Changes |
|---|---|
| `src/index.css` | Darken muted text |
| `src/components/ui/button.tsx` | Hover animations |
| `src/components/WhatsAppButton.tsx` | Right-side positioning, desktop mode fix, phone mask |
| `src/components/ContactForm.tsx` | Phone mask, email autocomplete, accent divider |
| `src/components/Footer.tsx` | Top accent divider + padding |
| `src/components/EmailInput.tsx` | New reusable component |
| `src/pages/Order.tsx` | Email required + validation, sticky timeline, back button |

