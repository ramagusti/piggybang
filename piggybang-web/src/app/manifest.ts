import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Piggybang",
    short_name: "Piggybang",
    description: "Catat keuangan keluarga dari WhatsApp dan web.",
    start_url: "/app/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFBEB",
    theme_color: "#4F46E5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
