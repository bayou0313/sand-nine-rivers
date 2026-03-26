

## Device-Aware Contact Button

Adapt the floating contact button behavior based on whether the user is on mobile or desktop.

### Behavior

**Mobile (< 768px):**
- Toggle button with two modes: **WhatsApp** (opens WhatsApp chat) and **Phone** (direct `tel:` call)
- Same toggle pill UI as current implementation
- Bottom bar stays as-is for quick calling

**Desktop (≥ 768px):**
- Toggle button with two modes: **WhatsApp** (opens WhatsApp web chat) and **Message Us** (opens a small contact popup/modal)
- Instead of `tel:` link (useless on desktop), the phone mode becomes a quick message form — name, phone, short message — submitted via the existing `send-email` edge function
- Small floating form appears above the button when in "message" mode, with fields for name, phone number, and message
- On submit: sends via `send-email` function, shows confirmation, then closes

### File Changes

**`src/components/WhatsAppButton.tsx`:**
- Import `useIsMobile` hook
- Change `ContactMode` type to `"whatsapp" | "phone" | "message"`
- On mobile: modes are `whatsapp` ↔ `phone` (current behavior, `tel:` link)
- On desktop: modes are `whatsapp` ↔ `message`
- In "message" mode: render a small animated popup form above the button (name, phone, message fields)
- Form submits to `supabase.functions.invoke("send-email", { body: { type: "contact", data } })`
- Icon for message mode: `Mail` icon with primary color background
- Success state shows a checkmark briefly, then closes

### Design
- Popup form: ~300px wide card floating above the button, with smooth scale/fade animation
- Matches existing design tokens (rounded-2xl, border-border, shadow-2xl)
- Close button on the popup to dismiss without sending

