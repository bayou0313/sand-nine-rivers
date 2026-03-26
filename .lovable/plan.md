

## Always-On Countdown: Shared Hook + Pricing & Checkout

Extract the countdown into a shared hook that **always counts down to the next 10 AM cutoff**, then display it in Hero, Pricing, and Order pages.

### Shared Hook — `src/hooks/use-countdown.ts`

New file with the always-on countdown logic:
- **Before 10 AM weekday** → count down to today 10 AM, label: "SAME-DAY DELIVERY CLOSES IN", nextDay: "today"
- **After 10 AM Mon–Thu** → count down to tomorrow 10 AM, label: "TOMORROW'S DELIVERY CLOSES IN", nextDay: "tomorrow"
- **After 10 AM Friday** → count down to Monday 10 AM, label: "MONDAY DELIVERY CLOSES IN", nextDay: "Monday"
- **Saturday before 10 AM** → count down to today 10 AM, label: "SATURDAY DELIVERY CLOSES IN", nextDay: "today"
- **Saturday after 10 AM / Sunday** → count down to Monday 10 AM, label: "MONDAY DELIVERY CLOSES IN", nextDay: "Monday"
- Returns `{ timeLeft, label, nextDay }` — timer is **never empty**

### `src/components/Hero.tsx`
- Remove inline `useCountdown` hook
- Import from `@/hooks/use-countdown`
- Always show countdown (remove `isActive` conditional) — use `label` for the text, `timeLeft` for the timer

### `src/components/Pricing.tsx`
- Import `useCountdown` from shared hook
- Add a compact countdown banner above the pricing card subtitle — clock icon + label + ticking time in accent color

### `src/pages/Order.tsx`
- Import `useCountdown` from shared hook
- Add a slim urgency bar at the top of the checkout form area — clock icon + label + countdown timer

