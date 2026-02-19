import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { logger } from "./lib/logger";

// Global error handlers for uncaught errors
window.addEventListener('error', (event) => {
  logger.error('Uncaught global error', event.error, {
    component: 'window',
    action: 'error',
  });
});

window.addEventListener('unhandledrejection', (event) => {
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
      onError={(error, errorInfo) => {
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
