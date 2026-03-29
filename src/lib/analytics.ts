/* GTM dataLayer helper — all events routed through Google Tag Manager */

declare global {
  interface Window {
    dataLayer: Record<string, any>[];
  }
}

/**
 * Push a custom event into the GTM dataLayer.
 * GTM handles all tag firing (GA4, Ads, etc.).
 * Fails silently if dataLayer is unavailable.
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, any>,
): void {
  try {
    if (typeof window === "undefined") return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: eventName,
      ...params,
    });
  } catch (err) {
    console.warn("[GTM] Event failed:", err);
  }
}
