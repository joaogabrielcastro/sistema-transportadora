// frontend/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: {
        globPatterns: ["**/*.{js,css,ico,png,svg,woff2}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
      includeAssets: [
        "favicon.ico",
        "atrack-180x180.png",
        "atrack-192x192.png",
        "atrack-512x512.png",
      ],
      manifest: {
        name: "ATrack — Gestão de Frotas",
        short_name: "ATrack",
        description: "Sistema multi-empresa de gestão de frota e manutenção",
        theme_color: "#0F172A",
        background_color: "#FFFFFF",
        icons: [
          {
            src: "atrack-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "atrack-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "atrack-180x180.png",
            sizes: "180x180",
            type: "image/png",
          },
        ],
        display: "standalone",
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
});
