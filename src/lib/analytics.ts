/* GTM dataLayer helper — all events routed through Google Tag Manager */
import { isNoTrack, isNoTrackIP } from "@/lib/session";

declare global {
  interface Window {
    dataLayer: Record<string, any>[];
  }
}

/**
 * No-track resolution strategy:
 * - The synchronous `isNoTrack()` flag (localStorage `rsnd_notrack`) is checked
 *   on every call — this catches the common case (admin, ?notrack=1 visitors).
 * - The async `isNoTrackIP()` check (queries backend `notrack_ips` list) is
 *   kicked off once at module init. Once resolved, if the IP is on the list,
 *   localStorage is set so subsequent sync checks return true.
 * - Limitation: events fired before the async IP check resolves may slip
 *   through to dataLayer. This is acceptable — IP-based suppression is a
 *   safety net; the primary suppression is the sync localStorage flag which
 *   is set the first time an admin visits with ?notrack=1.
 */
let ipCheckResolved = false;
if (typeof window !== "undefined") {
  isNoTrackIP()
    .catch(() => false)
    .finally(() => {
      ipCheckResolved = true;
    });
}

/**
 * Push a custom event into the GTM dataLayer.
 * GTM handles all tag firing (GA4, Ads, etc.).
 * Suppresses events for users flagged as internal/no-track traffic.
 * Fails silently if dataLayer is unavailable.
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, any>,
): void {
  try {
    if (typeof window === "undefined") return;
    if (isNoTrack()) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: eventName,
      ...params,
    });
  } catch (err) {
    console.warn("[GTM] Event failed:", err);
  }
}
