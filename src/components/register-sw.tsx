"use client";
import { useEffect } from "react";

/** Registers the offline service worker once the app is interactive. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // A failed registration only costs offline support, so stay quiet.
    });
  }, []);
  return null;
}
