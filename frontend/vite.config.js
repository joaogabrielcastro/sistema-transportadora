// frontend/vite.config.js
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const buildId =
  process.env.BUILD_ID ||
  process.env.COOLIFY_BUILD_ID ||
  process.env.SOURCE_COMMIT ||
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function atrackVersionPlugin() {
  return {
    name: "atrack-version",
    writeBundle(outputOptions) {
      const outDir = outputOptions.dir || path.resolve("dist");
      const payload = {
        buildId,
        builtAt: new Date().toISOString(),
      };
      fs.writeFileSync(
        path.join(outDir, "version.json"),
        `${JSON.stringify(payload, null, 2)}\n`,
      );
    },
  };
}

export default defineConfig({
  define: {
    __ATRACK_BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    react(),
    atrackVersionPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigationPreload: true,
        // version.json nunca no precache — sempre rede
        navigateFallbackDenylist: [/^\/version\.json$/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === "/version.json",
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "atrack-html",
              networkTimeoutSeconds: 3,
            },
          },
        ],
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
        background_color: "#0F172A",
        icons: [
          {
            src: "atrack-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "atrack-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "atrack-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "atrack-180x180.png",
            sizes: "180x180",
            type: "image/png",
            purpose: "any",
          },
        ],
        display: "standalone",
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
});
