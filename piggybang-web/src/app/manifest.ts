import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PiggyBang!",
    short_name: "PiggyBang!",
    description: "Catat keuangan keluarga dari WhatsApp dan web.",
    start_url: "/app/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFBEB",
    theme_color: "#FFFBEB",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android adaptive icons crop to a circle/squircle: opaque, mark inside the centre safe zone.
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
