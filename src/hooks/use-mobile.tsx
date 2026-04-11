import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;

const checkMobile = (): boolean => {
  if (typeof window === "undefined") return false;
  const byWidth = window.innerWidth < MOBILE_BREAKPOINT;
  const byTouch = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  const byAgent = typeof navigator !== "undefined" && /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent);
  return byWidth || (byTouch && window.innerWidth < 1024) || byAgent;
};

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(checkMobile);

  useEffect(() => {
    // Re-check immediately on mount
    setIsMobile(checkMobile());

    const handler = () => setIsMobile(checkMobile());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return isMobile;
}
