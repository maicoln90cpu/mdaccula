import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseRenderStaticMapUrl, cacheStaticMapImagesInHtml, resolveMapImage } from "./renderStaticMapCache.ts";

Deno.test("parseRenderStaticMapUrl: extrai parâmetros de URL absoluta", () => {
  const url = "https://xfvpuzlspvvsmmunznxw.supabase.co/functions/v1/render-static-map?lat=-23.5&lng=-46.6&zoom=15&w=600&h=300&style=roadmap&pincolor=%23a855f7";
  const params = parseRenderStaticMapUrl(url);
  assertEquals(params?.lat, -23.5);
  assertEquals(params?.lng, -46.6);
  assertEquals(params?.zoom, 15);
  assertEquals(params?.w, 600);
  assertEquals(params?.h, 300);
  assertEquals(params?.style, "roadmap");
  assertEquals(params?.pinColor, "#a855f7");
});

Deno.test("parseRenderStaticMapUrl: retorna null para coordenadas inválidas", () => {
  assertEquals(parseRenderStaticMapUrl("https://x.supabase.co/functions/v1/render-static-map?lat=abc&lng=100"), null);
});

Deno.test("parseRenderStaticMapUrl: retorna null para URL sem lat/lng", () => {
  assertEquals(parseRenderStaticMapUrl("https://x.supabase.co/functions/v1/render-static-map?zoom=15"), null);
});

Deno.test("cacheStaticMapImagesInHtml: retorna HTML inalterado quando não há render-static-map", async () => {
  const html = "<html><body><img src=\"https://example.com/img.png\"></body></html>";
  const result = await cacheStaticMapImagesInHtml(html);
  assertEquals(result, html);
});

Deno.test("cacheStaticMapImagesInHtml: mantém HTML original quando URL do mapa é inválida", async () => {
  const html = '<html><body><img src="https://x.supabase.co/functions/v1/render-static-map?lat=abc&lng=100"></body></html>';
  const result = await cacheStaticMapImagesInHtml(html);
  assertEquals(result, html);
});

Deno.test("parseRenderStaticMapUrl: extrai parâmetros mesmo com '&' escapado como '&amp;' (atributo HTML real)", () => {
  // src="..." gerado por escape() no emailBlocks vem com "&amp;" entre os
  // parâmetros. Sem decodificar antes de montar a URLSearchParams, apenas
  // "lat" é reconhecido e os demais viram chaves como "amp;lng" — regressão
  // que fazia o cache de mapas nunca funcionar em e-mails reais.
  const rawFromHtmlAttr =
    "https://x.supabase.co/functions/v1/render-static-map?lat=-23.5557714&amp;lng=-46.6395571&amp;zoom=15&amp;w=600&amp;h=300&amp;style=roadmap";
  const decoded = rawFromHtmlAttr.replace(/&amp;/g, "&");
  const params = parseRenderStaticMapUrl(decoded);
  assertEquals(params?.lat, -23.5557714);
  assertEquals(params?.lng, -46.6395571);
  assertEquals(params?.zoom, 15);
});

Deno.test("resolveMapImage: cache HIT no Bunny nunca chama a API do Google (generateImage não é invocado)", async () => {
  const original = globalThis.fetch;
  let generateImageCalls = 0;
  try {
    // Qualquer HEAD ao Bunny CDN responde 200 (arquivo já existe).
    globalThis.fetch = () => Promise.resolve(new Response(null, { status: 200 }));

    const result = await resolveMapImage(
      { lat: -23.5, lng: -46.6, zoom: 15, w: 600, h: 300, style: "roadmap", pinColor: "red" },
      () => {
        generateImageCalls++;
        return Promise.resolve(new Response(new ArrayBuffer(0), { status: 200 }));
      },
    );

    assertEquals(generateImageCalls, 0);
    assertEquals(result.source, "bunny");
  } finally {
    globalThis.fetch = original;
  }
});
