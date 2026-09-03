import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import App from "./App.jsx";
import "./index.css";
import { ToastProvider } from "./components/ui/ToastProvider.jsx";
import { queryClient } from "./lib/queryClient.js";
import { AuthProvider } from "./context/AuthContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { initPwaAutoUpdate } from "./pwaRegister.js";
import { initVersionWatch } from "./versionWatch.js";
import { purgePwaStorage } from "./utils/serviceWorkerCleanup.js";
import { initMonitoring } from "./lib/monitoring.js";

void initMonitoring();

initPwaAutoUpdate();
initVersionWatch();

const CHUNK_RELOAD_KEY = "atrack_chunk_reload";

function isChunkLoadError(error) {
  const msg = String(error?.message || error || "");
  const name = String(error?.name || "");
  return (
    name === "ChunkLoadError" ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg)
  );
}

async function recoverFromStaleCache() {
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === "1") return;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  try {
    await purgePwaStorage();
  } catch {
    /* still reload */
  }
  window.location.reload();
}

window.addEventListener("error", (event) => {
  if (isChunkLoadError(event.error || event.message)) {
    event.preventDefault();
    void recoverFromStaleCache();
  }
});

window.addEventListener("unhandledrejection", (event) => {
  if (isChunkLoadError(event.reason)) {
    event.preventDefault();
    void recoverFromStaleCache();
  }
});

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
          {import.meta.env.DEV && (
            <ReactQueryDevtools
              initialIsOpen={false}
              buttonPosition="bottom-left"
            />
          )}
        </QueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  );
} else {
  console.error("Failed to find the root element.");
}
