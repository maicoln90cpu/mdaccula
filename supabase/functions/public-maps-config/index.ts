/**
 * public-maps-config
 *
 * Devolve a chave pública do Google Maps para o navegador (referrer-restrict
 * já protege a chave — não é secreta). Motivo de ficar em edge function em
 * vez de VITE_ no .env:
 *   - permite rotacionar a chave sem republicar o frontend;
 *   - o `.env` é sobrescrito por connectors, então evita conflito com
 *     `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`.
 *
 * Fallback: se `GOOGLE_MAPS_BROWSER_KEY_CUSTOM` não estiver setado, devolve
 * a chave gerenciada pela Lovable (`GOOGLE_MAPS_BROWSER_KEY`), preservando
 * o comportamento antigo em preview.
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const custom = Deno.env.get("GOOGLE_MAPS_BROWSER_KEY_CUSTOM");
  const managed = Deno.env.get("GOOGLE_MAPS_BROWSER_KEY");
  const key = custom || managed || null;

  return new Response(
    JSON.stringify({
      browser_key: key,
      source: custom ? "custom" : managed ? "managed" : "none",
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        // Cache no navegador por 1h — chave muda raramente.
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
});
