import { useEffect } from 'react';

export const HotjarAnalytics = () => {
  useEffect(() => {
    const hotjarId = import.meta.env.VITE_HOTJAR_ID;
    
    if (!hotjarId || !import.meta.env.PROD) return;

    const initHotjar = () => {
      (function(h: any, o, t, j, a, r) {
        h.hj = h.hj || function() {
          (h.hj.q = h.hj.q || []).push(arguments);
        };
        h._hjSettings = { hjid: hotjarId, hjsv: 6 };
        a = o.getElementsByTagName('head')[0];
        r = o.createElement('script');
        r.async = 1;
        r.src = t + h._hjSettings.hjid + j + h._hjSettings.hjsv;
        a.appendChild(r);
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
