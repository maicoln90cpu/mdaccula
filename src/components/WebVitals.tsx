import { useEffect } from 'react';
import { logger } from '@/lib/logger';

const webVitalsLogger = logger.scope({ component: 'WebVitals' });

export const WebVitals = () => {
  useEffect(() => {
    // Core Web Vitals monitoring
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint (LCP)
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number };
          const value = lastEntry.renderTime || lastEntry.loadTime;
          (window as unknown as { __webVitals?: Record<string, number> }).__webVitals ??= {};
          (window as unknown as { __webVitals: Record<string, number> }).__webVitals.lcp = value ?? 0;
          webVitalsLogger.debug('LCP measured', { value });
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch {
        webVitalsLogger.debug('LCP not supported');
      }

      // First Input Delay (FID)
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: PerformanceEntry & { processingStart?: number }) => {
            webVitalsLogger.debug('FID measured', { 
              value: (entry.processingStart ?? 0) - entry.startTime 
            });
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch {
        webVitalsLogger.debug('FID not supported');
      }

      // Cumulative Layout Shift (CLS)
      try {
        let clsScore = 0;
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: PerformanceEntry & { hadRecentInput?: boolean; value?: number }) => {
            if (!entry.hadRecentInput) {
              clsScore += entry.value ?? 0;
              (window as unknown as { __webVitals?: Record<string, number> }).__webVitals ??= {};
              (window as unknown as { __webVitals: Record<string, number> }).__webVitals.cls = clsScore;
              webVitalsLogger.debug('CLS measured', { value: clsScore });
            }
          });
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch {
        webVitalsLogger.debug('CLS not supported');
      }
    }

    // Register Service Worker for caching
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then((registration) => {
          webVitalsLogger.info('Service Worker registered', { 
            scope: registration.scope 
          });
        })
        .catch((error) => {
          webVitalsLogger.error('Service Worker registration failed', error);
        });
    }
  }, []);

  return null;
};
