import type { MetadataRoute } from "next";

// Feature: installable PWA. Together with the service worker in public/sw.js
// this makes the app open from the home screen and survive a dropped signal.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nourish — calorie tracker",
    short_name: "Nourish",
    description: "Type what you ate. Nourish works out the calories.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbfbfa",
    theme_color: "#fbfbfa",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
