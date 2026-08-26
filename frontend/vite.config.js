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
    transformIndexHtml(html) {
      const bootstrap = `
    <meta name="atrack-build" content="${buildId}" />
    <script>
      (function () {
        var KEY = "atrack_boot_reload";
        try {
          if (sessionStorage.getItem(KEY) === "1") {
            sessionStorage.removeItem(KEY);
            return;
          }
        } catch (e) {}
        fetch("/version.json?t=" + Date.now(), { cache: "no-store" })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (data) {
            if (!data || !data.buildId) return;
            var meta = document.querySelector('meta[name="atrack-build"]');
            var local = meta && meta.getAttribute("content");
            if (!local || local === data.buildId) return;
            try { sessionStorage.setItem(KEY, "1"); } catch (e) {}
            var done = Promise.resolve();
            if ("serviceWorker" in navigator) {
              done = navigator.serviceWorker.getRegistrations().then(function (regs) {
                return Promise.all(regs.map(function (r) { return r.unregister(); }));
              });
            }
            if (typeof caches !== "undefined") {
              done = done.then(function () {
                return caches.keys().then(function (keys) {
                  return Promise.all(keys.map(function (k) { return caches.delete(k); }));
                });
              });
            }
            return done.then(function () {
              var url = new URL(window.location.href);
              url.searchParams.set("_atrack", Date.now().toString(36));
              window.location.replace(url.toString());
            });
          })
          .catch(function () {});
      })();
    </script>`;
      return html.replace("</head>", `${bootstrap}\n  </head>`);
    },
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
        // Não precachear HTML — senão o "Ver" some até hard refresh.
        // navigateFallback null: sem NavigationRoute servindo index.html velho.
        globPatterns: ["**/*.{js,css,ico,png,svg,woff2}"],
        globIgnores: ["**/atrack-sw-clients.js", "**/version.json"],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        navigationPreload: false,
        importScripts: ["atrack-sw-clients.js"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === "/version.json",
            handler: "NetworkOnly",
          },
          {
            urlPattern: ({ url }) => url.pathname === "/atrack-sw-clients.js",
            handler: "NetworkOnly",
          },
          {
            // Toda navegação (/, /notas-estoque, …) só pela rede
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkOnly",
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
