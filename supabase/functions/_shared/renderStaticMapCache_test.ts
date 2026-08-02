import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseRenderStaticMapUrl, cacheStaticMapImagesInHtml } from "./renderStaticMapCache.ts";

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
