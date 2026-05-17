import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Asiatek POS",
    short_name: "POS",
    description: "POS offline-first untuk operasional toko.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f4",
    theme_color: "#0b6e4f",
    lang: "id-ID",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
