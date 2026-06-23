// Edge function pública - notifica IndexNow (Bing/Yandex) quando conteúdo
// novo é criado/publicado. Também expõe a chave em GET para o passo de build
// gerar o arquivo de verificação public/<chave>.txt.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const INDEXNOW_KEY = Deno.env.get("INDEXNOW_KEY") ?? "";
const HOST = "mdaccula.com";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!INDEXNOW_KEY) {
    return jsonResponse({ ok: false, error: "INDEXNOW_KEY not configured" }, 500);
  }

  // GET → expõe a chave em texto puro (uso interno de build para gerar
  // public/<chave>.txt — chave IndexNow é pública por design).
  if (req.method === "GET") {
    return new Response(INDEXNOW_KEY, {
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawUrls: unknown = body?.urls;
    const urls = Array.isArray(rawUrls)
      ? rawUrls
          .filter((u): u is string => typeof u === "string" && u.startsWith("https://"))
          .slice(0, 10000)
      : [];

    if (urls.length === 0) {
      return jsonResponse({ ok: false, error: "no valid urls provided" }, 400);
    }

    const payload = {
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
      urlList: urls,
    };

    const res = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });

    // IndexNow retorna 200/202 em sucesso. Corpo geralmente vazio.
    const text = await res.text().catch(() => "");
    console.log("[indexnow] status=%d urls=%d body=%s", res.status, urls.length, text);

    return jsonResponse({ ok: res.ok, status: res.status, urls: urls.length });
  } catch (err) {
    console.error("[indexnow] erro:", err);
    return jsonResponse({ ok: false, error: (err as Error).message }, 500);
  }
});
