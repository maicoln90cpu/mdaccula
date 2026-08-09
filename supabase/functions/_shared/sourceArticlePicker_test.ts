import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { discoverArticleUrls, pickArticleUrl, fetchSourceLinks, scrapeArticleContent } from "./sourceArticlePicker.ts";

const source = { url: "https://exemplo-noticias.com.br/", name: "Exemplo Notícias" };

Deno.test("discoverArticleUrls mantém só links de matéria do mesmo domínio", () => {
  const links = [
    "https://exemplo-noticias.com.br/2026/08/solomun-anuncia-turne-brasileira",
    "https://outro-site.com.br/algum-artigo",
    "https://exemplo-noticias.com.br/2026/08/nova-label-lanca-primeiro-ep",
  ];

  const result = discoverArticleUrls(source, links);
  assertEquals(result, [
    "https://exemplo-noticias.com.br/2026/08/solomun-anuncia-turne-brasileira",
    "https://exemplo-noticias.com.br/2026/08/nova-label-lanca-primeiro-ep",
  ]);
});

Deno.test("discoverArticleUrls descarta a raiz do domínio (homepage, não é matéria)", () => {
  const links = ["https://exemplo-noticias.com.br/", "https://exemplo-noticias.com.br"];
  assertEquals(discoverArticleUrls(source, links), []);
});

Deno.test("discoverArticleUrls descarta páginas de categoria/tag/institucional", () => {
  const links = [
    "https://exemplo-noticias.com.br/categoria/eventos",
    "https://exemplo-noticias.com.br/tag/techno",
    "https://exemplo-noticias.com.br/sobre",
    "https://exemplo-noticias.com.br/contato",
    "https://exemplo-noticias.com.br/2026/08/matéria-real",
  ];
  assertEquals(discoverArticleUrls(source, links), ["https://exemplo-noticias.com.br/2026/08/matéria-real"]);
});

Deno.test("discoverArticleUrls descarta redes sociais linkadas pela própria fonte", () => {
  const links = [
    "https://instagram.com/exemplonoticias",
    "https://exemplo-noticias.com.br/2026/08/matéria-real",
  ];
  assertEquals(discoverArticleUrls(source, links), ["https://exemplo-noticias.com.br/2026/08/matéria-real"]);
});

Deno.test("discoverArticleUrls exclui URLs já usadas antes (dedupe contra histórico)", () => {
  const links = [
    "https://exemplo-noticias.com.br/2026/08/ja-usada",
    "https://exemplo-noticias.com.br/2026/08/nova",
  ];
  const result = discoverArticleUrls(source, links, ["https://exemplo-noticias.com.br/2026/08/ja-usada"]);
  assertEquals(result, ["https://exemplo-noticias.com.br/2026/08/nova"]);
});

Deno.test("discoverArticleUrls dedupe também ignora barra final na comparação", () => {
  const links = ["https://exemplo-noticias.com.br/2026/08/ja-usada/"];
  const result = discoverArticleUrls(source, links, ["https://exemplo-noticias.com.br/2026/08/ja-usada"]);
  assertEquals(result, []);
});

Deno.test("discoverArticleUrls remove duplicatas dentro da própria página", () => {
  const links = [
    "https://exemplo-noticias.com.br/2026/08/matéria-a",
    "https://exemplo-noticias.com.br/2026/08/matéria-a",
  ];
  assertEquals(discoverArticleUrls(source, links).length, 1);
});

Deno.test("discoverArticleUrls descarta link inválido sem quebrar", () => {
  const links = ["não é uma url", "https://exemplo-noticias.com.br/2026/08/matéria-real"];
  assertEquals(discoverArticleUrls(source, links), ["https://exemplo-noticias.com.br/2026/08/matéria-real"]);
});

Deno.test("pickArticleUrl escolhe o primeiro candidato (mais próximo do topo da listagem)", () => {
  assertEquals(pickArticleUrl(["https://a.com/1", "https://a.com/2"]), "https://a.com/1");
});

Deno.test("pickArticleUrl retorna null sem candidatos", () => {
  assertEquals(pickArticleUrl([]), null);
});

function withMockedFetch<T>(response: { ok: boolean; status?: number; body: unknown }, run: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve({
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      json: () => Promise.resolve(response.body),
      text: () => Promise.resolve(JSON.stringify(response.body)),
    } as Response)) as typeof fetch;
  return run().finally(() => {
    globalThis.fetch = originalFetch;
  });
}

Deno.test("fetchSourceLinks retorna os links da resposta do Firecrawl", async () => {
  const links = await withMockedFetch(
    { ok: true, body: { data: { links: ["https://exemplo.com/a", "https://exemplo.com/b"] } } },
    () => fetchSourceLinks("https://exemplo.com/", "fake-key")
  );
  assertEquals(links, ["https://exemplo.com/a", "https://exemplo.com/b"]);
});

Deno.test("fetchSourceLinks retorna array vazio quando não há links na resposta", async () => {
  const links = await withMockedFetch({ ok: true, body: { data: {} } }, () =>
    fetchSourceLinks("https://exemplo.com/", "fake-key")
  );
  assertEquals(links, []);
});

Deno.test("scrapeArticleContent retorna o markdown da matéria", async () => {
  const result = await withMockedFetch(
    { ok: true, body: { data: { markdown: "conteúdo real da matéria" } } },
    () => scrapeArticleContent("https://exemplo.com/artigo", "fake-key")
  );
  assertEquals(result?.markdown, "conteúdo real da matéria");
});

Deno.test("scrapeArticleContent retorna null quando não há markdown real", async () => {
  const result = await withMockedFetch({ ok: true, body: { data: { markdown: "" } } }, () =>
    scrapeArticleContent("https://exemplo.com/artigo", "fake-key")
  );
  assertEquals(result, null);
});

Deno.test("scrapeArticleContent retorna null em falha HTTP (nunca lança)", async () => {
  const result = await withMockedFetch({ ok: false, status: 500, body: { error: "boom" } }, () =>
    scrapeArticleContent("https://exemplo.com/artigo", "fake-key")
  );
  assertEquals(result, null);
});
