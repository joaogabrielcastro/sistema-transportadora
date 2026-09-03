// frontend/vite.config.js
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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
        var STORE = "atrack_build_id";
        try {
          if (sessionStorage.getItem(KEY) === "1") {
            sessionStorage.removeItem(KEY);
            return;
          }
        } catch (e) {}
        function disablePreloadAndUnregister(regs) {
          return Promise.all(regs.map(function (reg) {
            var p = Promise.resolve();
            if (reg.navigationPreload) {
              p = reg.navigationPreload.disable().catch(function () {});
            }
            return p.then(function () { return reg.unregister(); });
          }));
        }
        function wipeAndReload() {
          try { sessionStorage.setItem(KEY, "1"); } catch (e) {}
          var done = Promise.resolve();
          if ("serviceWorker" in navigator) {
            done = navigator.serviceWorker.getRegistrations().then(disablePreloadAndUnregister);
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
        }
        fetch("/version.json?t=" + Date.now(), { cache: "no-store" })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (data) {
            if (!data || !data.buildId) return;
            var meta = document.querySelector('meta[name="atrack-build"]');
            var local = meta && meta.getAttribute("content");
            var stored = null;
            try { stored = localStorage.getItem(STORE); } catch (e) {}
            if (local && local !== data.buildId) return wipeAndReload();
            if (stored && stored !== data.buildId) return wipeAndReload();
            try { localStorage.setItem(STORE, data.buildId); } catch (e) {}
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
  plugins: [react(), atrackVersionPlugin()],
});
