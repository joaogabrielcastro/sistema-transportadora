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
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
      },
      includeAssets: [
        "favicon.ico",
        "abrotto-180x180.png",
        "abrotto-192x192.png", // Corrigido o nome
        "abrotto-512x512.png", // Corrigido o nome
      ],
      manifest: {
        name: "Sistema Transportadora",
        short_name: "TransporteApp",
        description: "Gestão de Manutenção e Frota",
        theme_color: "#FF0000",
        background_color: "#FFFFFF",
        icons: [
          {
            src: "abrotto-512x512.png", // Corrigido
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "abrotto-192x192.png", // Corrigido
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "abrotto-180x180.png", // Corrigido
            sizes: "180x180",
            type: "image/png",
          },
        ],
        display: "standalone", // Garante o prompt de instalação
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
});
