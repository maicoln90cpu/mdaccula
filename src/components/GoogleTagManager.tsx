import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const GoogleTagManager = () => {
  const [gtmId, setGtmId] = useState<string>("");

  useEffect(() => {
    // Defer fetching GTM ID until after main content is interactive
    const initGTM = () => {
      const fetchGTMId = async () => {
        const { data } = await supabase
          .from("site_settings")
          .select("value")
          .eq("key", "google_tag_manager_id")
          .single();

        if (data?.value && data.value.trim() !== "") {
          setGtmId(data.value);
        }
      };
      fetchGTMId();
    };

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(initGTM, { timeout: 4000 });
    } else {
      setTimeout(initGTM, 3000);
    }
  }, []);

  useEffect(() => {
    if (!gtmId) return;

    const script1 = document.createElement("script");
    script1.innerHTML = `
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${gtmId}');
    `;
    document.head.appendChild(script1);

    const noscript = document.createElement("noscript");
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.googletagmanager.com/ns.html?id=${gtmId}`;
    iframe.height = "0";
    iframe.width = "0";
    iframe.style.display = "none";
    iframe.style.visibility = "hidden";
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
