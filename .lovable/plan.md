

## Request a Callback — Time-Aware Form with Date Picker

Replace the desktop "Message Us" form with a smart "Request a Callback" form that respects business hours and prevents selecting past times.

### Business Rules
- **Operating hours**: Mon–Fri 8 AM – 6 PM, Saturday 8 AM – 12 PM (limited to 5 same-day slots), Sunday closed
- **Time windows are filtered**: only show future windows for today; show all windows for future dates
- **Date picker**: allows selecting today (if windows remain) or future business days (no Sundays)
- **Saturday limit**: show a "Limited Saturday availability — 5 spots" note when Saturday is selected

### Hero Countdown Fix
- Change cutoff from 11 AM to **10 AM** in the `useCountdown` hook
- When cutoff passes, show "Get your delivery **tomorrow**" (or Monday if Friday after cutoff / Saturday after cutoff)
- Respect the schedule: if it's Saturday after 10 AM, next same-day is Monday

### Form Fields
1. **Name** (required)
2. **Phone** (required)  
3. **Callback Date** — date picker defaulting to today, disabled for Sundays and past dates
4. **Preferred Time Window** — dropdown filtered to future-only slots for today:
   - "ASAP" (only if today and business hours)
   - "8–10 AM", "10 AM–12 PM", "12–2 PM", "2–4 PM", "4–6 PM" (Mon–Fri)
   - "8–10 AM", "10 AM–12 PM" (Saturday only)
5. **Notes** (optional, single line)

### File Changes

**`src/components/WhatsAppButton.tsx`:**
- Replace message form with "Request a Callback" form
- Add `callbackDate` (Date, default today) and `timeWindow` (string) to form state
- Add a date picker (Popover + Calendar from shadcn) — disable Sundays and past dates
- Filter time window options based on selected date + current time:
  - If selected date is today → only show windows whose start hour is in the future
  - If Saturday → only show morning windows + "Limited spots" badge
  - If future weekday → show all windows
- Change submit to `type: "callback"` 
- Success message: "Callback requested! We'll call you soon."

**`src/components/Hero.tsx`:**
- Change `cutoffHour` from 11 to 10
- When countdown is inactive (past cutoff or weekend), compute the next delivery day label:
  - Weekday after 10 AM → "tomorrow" (or "Monday" if Friday)
  - Saturday → "Monday"  
  - Sunday → "Monday"
- Display: "Order now for delivery **{nextDay}**" instead of static text

**`supabase/functions/send-email/index.ts`:**
- Add `"callback"` email type handler
- Internal email only (no customer email) with high-priority styling:
  - Red banner: "🔴 CALLBACK REQUEST"
  - Subject: `🔴 URGENT: Callback Request — {name}`
  - Body: name, phone, requested date, time window, notes
- No customer confirmation — just the urgent internal alert

