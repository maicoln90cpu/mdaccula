import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extractOgImageFromHtml,
  fetchOriginalArticleImage,
  parseFirecrawlImageResults,
  searchImageWithFirecrawl,
  downloadAndRehostImage,
  resolveArticleImage,
  deriveSearchTermFromUrl,
} from "./articleImage.ts";

Deno.test("deriveSearchTermFromUrl converte o slug em termo de busca", () => {
  assertEquals(
    deriveSearchTermFromUrl("https://exemplo.com/ultima-chance-de-garantir-ingressos-rock-in-rio"),
    "ultima chance de garantir ingressos rock in rio"
  );
});

Deno.test("deriveSearchTermFromUrl limita a 10 palavras", () => {
  const url = "https://exemplo.com/" + Array.from({ length: 15 }, (_, i) => `palavra${i}`).join("-");
  const term = deriveSearchTermFromUrl(url)!;
  assertEquals(term.split(" ").length, 10);
});

Deno.test("deriveSearchTermFromUrl retorna null pra raiz do domínio", () => {
  assertEquals(deriveSearchTermFromUrl("https://exemplo.com/"), null);
});

Deno.test("deriveSearchTermFromUrl retorna null pra URL inválida (nunca lança)", () => {
  assertEquals(deriveSearchTermFromUrl("não é uma url"), null);
});

Deno.test("extractOgImageFromHtml acha og:image", () => {
  const html = `<html><head><meta property="og:image" content="https://exemplo.com/foto.jpg"></head></html>`;
  assertEquals(extractOgImageFromHtml(html, "https://exemplo.com/artigo"), "https://exemplo.com/foto.jpg");
});

Deno.test("extractOgImageFromHtml cai pra twitter:image quando não há og:image", () => {
  const html = `<html><head><meta name="twitter:image" content="https://exemplo.com/foto2.jpg"></head></html>`;
  assertEquals(extractOgImageFromHtml(html, "https://exemplo.com/artigo"), "https://exemplo.com/foto2.jpg");
});

Deno.test("extractOgImageFromHtml resolve URL relativa contra a página", () => {
  const html = `<html><head><meta property="og:image" content="/img/foto.jpg"></head></html>`;
  assertEquals(extractOgImageFromHtml(html, "https://exemplo.com/artigo"), "https://exemplo.com/img/foto.jpg");
});

Deno.test("extractOgImageFromHtml retorna null sem meta tag de imagem", () => {
  const html = `<html><head><title>Sem imagem</title></head></html>`;
  assertEquals(extractOgImageFromHtml(html, "https://exemplo.com/artigo"), null);
});

Deno.test("parseFirecrawlImageResults extrai imageUrl/title/url dos resultados", () => {
  const data = {
    data: {
      images: [
        { title: "Foto do evento", imageUrl: "https://exemplo.com/foto.jpg", url: "https://exemplo.com/pagina" },
      ],
    },
  };
  assertEquals(parseFirecrawlImageResults(data), [
    { imageUrl: "https://exemplo.com/foto.jpg", title: "Foto do evento", pageUrl: "https://exemplo.com/pagina" },
  ]);
});

Deno.test("parseFirecrawlImageResults descarta item sem imageUrl", () => {
  const data = { data: { images: [{ title: "Sem imagem" }] } };
  assertEquals(parseFirecrawlImageResults(data), []);
});

Deno.test("parseFirecrawlImageResults retorna vazio quando a resposta não tem images", () => {
  assertEquals(parseFirecrawlImageResults({ data: {} }), []);
  assertEquals(parseFirecrawlImageResults({}), []);
});

function withMockedFetch<T>(response: { ok: boolean; status?: number; body?: unknown; headers?: Record<string, string>; text?: string; finalUrl?: string }, run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve({
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      url: response.finalUrl ?? "",
      headers: { get: (key: string) => response.headers?.[key.toLowerCase()] ?? null },
      json: () => Promise.resolve(response.body),
      text: () => Promise.resolve(response.text ?? JSON.stringify(response.body)),
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode(response.text ?? "fake-bytes").buffer),
    } as unknown as Response)) as typeof fetch;
  return run().finally(() => {
    globalThis.fetch = originalFetch;
  });
}

Deno.test("fetchOriginalArticleImage extrai og:image do HTML raspado", async () => {
  const html = `<html><head><meta property="og:image" content="https://exemplo.com/capa.jpg"></head></html>`;
  const result = await withMockedFetch(
    { ok: true, text: html, finalUrl: "https://exemplo.com/artigo" },
    () => fetchOriginalArticleImage("https://exemplo.com/artigo")
  );
  assertEquals(result, "https://exemplo.com/capa.jpg");
});

Deno.test("fetchOriginalArticleImage retorna null em falha HTTP (nunca lança)", async () => {
  const result = await withMockedFetch({ ok: false, status: 404 }, () =>
    fetchOriginalArticleImage("https://exemplo.com/artigo")
  );
  assertEquals(result, null);
});

Deno.test("searchImageWithFirecrawl retorna o primeiro resultado", async () => {
  const result = await withMockedFetch(
    {
      ok: true,
      body: { data: { images: [{ title: "Foto", imageUrl: "https://exemplo.com/x.jpg", url: "https://exemplo.com/p" }] } },
    },
    () => searchImageWithFirecrawl("tema qualquer", "fake-key")
  );
  assertEquals(result?.imageUrl, "https://exemplo.com/x.jpg");
});

Deno.test("searchImageWithFirecrawl retorna null sem resultados (nunca lança)", async () => {
  const result = await withMockedFetch({ ok: true, body: { data: { images: [] } } }, () =>
    searchImageWithFirecrawl("tema qualquer", "fake-key")
  );
  assertEquals(result, null);
});

Deno.test("downloadAndRehostImage retorna null em falha HTTP (nunca lança)", async () => {
  const result = await withMockedFetch({ ok: false, status: 403 }, () =>
    downloadAndRehostImage("https://exemplo.com/foto.jpg", "topic-original")
  );
  assertEquals(result, null);
});

Deno.test("resolveArticleImage retorna null quando as duas camadas falham (sem imagem, sem quebrar)", async () => {
  const result = await withMockedFetch({ ok: false, status: 500 }, () =>
    resolveArticleImage("https://exemplo.com/artigo", "Exemplo", "tema do artigo", "fake-key")
  );
  assertEquals(result, null);
});

function withSequentialMockedFetch<T>(
  responses: Array<{ ok: boolean; status?: number; body?: unknown; text?: string; finalUrl?: string }>,
  run: () => Promise<T>
): Promise<T> {
  const originalFetch = globalThis.fetch;
  let call = 0;
  globalThis.fetch = (() => {
    const response = responses[Math.min(call, responses.length - 1)];
    call++;
    return Promise.resolve({
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      url: response.finalUrl ?? "",
      headers: { get: () => null },
      json: () => Promise.resolve(response.body),
      text: () => Promise.resolve(response.text ?? JSON.stringify(response.body)),
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode(response.text ?? "fake-bytes").buffer),
    } as unknown as Response);
  }) as typeof fetch;
  return run().finally(() => {
    globalThis.fetch = originalFetch;
  });
}

// Regressão real de produção (09/08/2026): "Rock in Rio abre venda
// extraordinária..." (título editorial) não achou nada na busca de imagem —
// a matéria original tinha manchete bem diferente. resolveArticleImage deve
// tentar o termo derivado do slug da URL ANTES do título editorial.
Deno.test("resolveArticleImage tenta o termo do slug da URL antes do título editorial (regressão Rock in Rio)", async () => {
  Deno.env.set("BUNNY_STORAGE_API_KEY", "fake-bunny-key");
  const result = await withSequentialMockedFetch(
    [
      { ok: false, status: 404 }, // camada 1: og:image falha (sem og:image na fonte)
      { ok: true, body: { data: { images: [{ title: "Foto real", imageUrl: "https://exemplo.com/foto.jpg", url: "https://exemplo.com/pagina" }] } } }, // camada 2, 1ª tentativa: termo do slug acha
      { ok: true, text: "fake-bytes" }, // download/rehost
    ],
    () =>
      resolveArticleImage(
        "https://djnews.com.br/ultima-chance-rock-in-rio",
        "DJ News Brasil",
        "Rock in Rio abre venda extraordinária e revela cardápio",
        "fake-key"
      )
  );
  assertEquals(result?.credit, "Imagem: exemplo.com");
});
