import { useEffect } from 'react';
import { useSiteSettings } from '@/hooks/useSiteSettings';

const GoogleTagManager = () => {
  const { settings } = useSiteSettings();
  const gtmId = settings?.google_tag_manager_id;

  useEffect(() => {
    if (!gtmId || gtmId.trim() === '') return;

    const script1 = document.createElement('script');
    script1.innerHTML = `
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${gtmId}');
    `;
    document.head.appendChild(script1);

    const noscript = document.createElement('noscript');
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.googletagmanager.com/ns.html?id=${gtmId}`;
    iframe.height = '0';
    iframe.width = '0';
    iframe.style.display = 'none';
    iframe.style.visibility = 'hidden';
    noscript.appendChild(iframe);
    document.body.insertBefore(noscript, document.body.firstChild);

    return () => {
      document.head.removeChild(script1);
      if (noscript.parentNode) {
        document.body.removeChild(noscript);
      }
    };
  }, [gtmId]);

  return null;
};

export default GoogleTagManager;
