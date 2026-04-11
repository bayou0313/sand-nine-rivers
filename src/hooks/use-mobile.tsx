import { useState, useEffect } from "react";

const MOBILE_BREAKPOINT = 768;
const TOUCH_BREAKPOINT = 1024;

const checkMobile = () => {
  if (typeof window === "undefined") return false;
  const byWidth = window.innerWidth < MOBILE_BREAKPOINT;
  const byTouch = navigator.maxTouchPoints > 0;
  return byWidth || (byTouch && window.innerWidth < TOUCH_BREAKPOINT);
};

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => checkMobile());

  useEffect(() => {
    const handler = () => setIsMobile(checkMobile());
    window.addEventListener("resize", handler);
    // Re-check immediately on mount
    handler();
    return () => window.removeEventListener("resize", handler);
  }, []);

  return isMobile;
}
