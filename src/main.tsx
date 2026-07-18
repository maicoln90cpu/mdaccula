import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { logger } from "./lib/logger";

// --- Auto-recuperação de chunk obsoleto (após novo deploy) ---
// Vite renomeia os arquivos JS lazy-loaded a cada build. Se a aba já estava
// aberta antes do deploy, o import() falha porque o hash mudou.
// Aqui detectamos esses casos e recarregamos a página UMA vez, com guarda
// de 10s no sessionStorage para evitar loop infinito.
const CHUNK_RELOAD_KEY = "__chunk_reload_at";
function reloadForChunkError(reason: string) {
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || "0");
    if (Date.now() - last < 10_000) return; // já tentou recentemente
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    console.warn(`[chunk-reload] Recarregando após chunk obsoleto: ${reason}`);
    window.location.reload();
  } catch {
    window.location.reload();
  }
}
export function isChunkLoadError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message || err || "");
  return (
    msg.includes("dynamically imported module") ||
    msg.includes("Failed to fetch dynamically imported") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("error loading dynamically imported module")
  );
}

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault?.();
  reloadForChunkError("vite:preloadError");
});

window.addEventListener('error', (event) => {
  if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
    reloadForChunkError("window.error");
    return;
  }
  logger.error('Uncaught global error', event.error, {
    component: 'window',
    action: 'error',
  });
});

window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadError(event.reason)) {
    reloadForChunkError("unhandledrejection");
    return;
  }
  logger.error('Unhandled promise rejection', event.reason, {
    component: 'window',
    action: 'unhandledrejection',
  });
});

// Log app initialization
logger.info('MDAccula app initializing', {
  component: 'main',
  action: 'init',
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary
      onError={(error, _errorInfo) => {
        logger.error('Root ErrorBoundary caught error', error, {
          component: 'Root',
          action: 'errorBoundary',
        });
      }}
    >
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
