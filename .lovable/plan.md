

## Toggle Contact Button

Transform the current WhatsApp floating button into a toggle button that alternates between WhatsApp chat and phone call with a smooth animation.

### How it works
- Single floating button in the bottom-left corner
- Tapping toggles between two modes: **WhatsApp** (green, MessageCircle icon) and **Phone** (primary color, Phone icon)
- Each mode links to the appropriate action (`wa.me/...` for WhatsApp, `tel:+18554689297` for phone)
- Smooth icon rotation/flip animation on toggle
- A small label appears briefly showing the current mode ("WhatsApp" or "Call Us")

### File changes

**`src/components/WhatsAppButton.tsx`** → Rename concept to `ContactToggleButton`:
- Add `mode` state toggling between `"whatsapp"` and `"phone"`
- On tap of button area (not the link), toggle mode; on tap of icon/link, navigate
- Use `framer-motion` `AnimatePresence` to animate icon swap (scale + rotate transition)
- WhatsApp mode: green background, MessageCircle icon, links to `wa.me/15043582000`
- Phone mode: primary/accent background, Phone icon, links to `tel:+18554689297`
- Small animated label badge showing current mode text

### Design
- Same position: `fixed bottom-20 lg:bottom-6 left-6`
- Background color transitions smoothly between green (#25D366) and accent
- Icon swaps with a flip/rotate animation
- Small text label fades in below or beside the button

