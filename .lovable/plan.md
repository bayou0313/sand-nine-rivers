

## Fix: Default to "Message Us" on Desktop

The button currently defaults to WhatsApp mode on all devices. On desktop, it should default to "Message Us" (the contact form) instead.

### Change

**`src/components/WhatsAppButton.tsx`:**
- Change the initial `mode` state to be device-aware: default to `"message"` on desktop, `"whatsapp"` on mobile
- Since `isMobile` starts as `undefined` on first render, use a `useEffect` to set the correct default once the hook resolves

