import { useEffect } from 'react';

export const HotjarAnalytics = () => {
  useEffect(() => {
    const hotjarId = import.meta.env.VITE_HOTJAR_ID;
    
    if (!hotjarId || !import.meta.env.PROD) return;

    const initHotjar = () => {
      (function(h: any, o, t, j) {
        h.hj = h.hj || function(...args: unknown[]) {
          (h.hj.q = h.hj.q || []).push(args);
        };
        h._hjSettings = { hjid: hotjarId, hjsv: 6 };
        const head = o.getElementsByTagName('head')[0];
        const script = o.createElement('script');
        script.async = true;
        script.src = t + h._hjSettings.hjid + j + h._hjSettings.hjsv;
        head.appendChild(script);
      })(window, document, 'https://static.hotjar.com/c/hotjar-', '.js?sv=');
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(initHotjar, { timeout: 5000 });
    } else {
      setTimeout(initHotjar, 3500);
    }
  }, []);

  return null;
};
