"use client";

import { useEffect } from "react";

/** Registers the service worker (production only — dev builds skip it so
 * stale caches never confuse local work). */
export function SWRegister() {
  useEffect(() => {
    if (
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* PWA features degrade gracefully */
      });
    }
  }, []);
  return null;
}
