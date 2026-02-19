import { useEffect } from 'react';

export const HotjarAnalytics = () => {
  useEffect(() => {
    // Hotjar Tracking Code
    // Replace HOTJAR_ID with your actual Hotjar Site ID when available
    const hotjarId = import.meta.env.VITE_HOTJAR_ID;
    
    if (hotjarId && import.meta.env.PROD) {
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
    }
  }, []);

  return null;
};
