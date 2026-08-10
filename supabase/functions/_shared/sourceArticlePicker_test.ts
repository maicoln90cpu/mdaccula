import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  discoverArticleUrls,
  pickArticleUrl,
  fetchSourceLinks,
  scrapeArticleContent,
  findListingIndexUrls,
} from "./sourceArticlePicker.ts";

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

// Regressão real de produção (09/08/2026): "Play BPM" tinha um link de menu
// pra "/noticias/" na homepage, que passava como se fosse 1 matéria — a IA
// recusou gerar (insufficientSources), mas o resultado pro admin foi
// "gerei e não deu certo" (nenhum artigo saiu). Ver docs/TESTING.md R-048.
// Regressão real de produção (09/08/2026): "House Mag" tinha um link de menu
// pra "/login" na homepage — não bate raiz, categoria, tag nem nenhuma
// palavra do blocklist institucional, então passava como se fosse "a
// matéria". Prova que blocklist de palavras nunca cobre o universo inteiro
// de páginas utilitárias — daí a troca pra sinal positivo (looksLikeArticleSlug).
Deno.test("discoverArticleUrls descarta página utilitária de 1 palavra sem hífen (ex.: /login, bug real House Mag)", () => {
  const houseMagSource = { url: "https://housemag.com.br/", name: "House Mag" };
  const links = [
    "https://housemag.com.br/login",
    "https://housemag.com.br/joyce-muniz-revisita-memorias-do-house-anos-90",
  ];
  assertEquals(discoverArticleUrls(houseMagSource, links), [
    "https://housemag.com.br/joyce-muniz-revisita-memorias-do-house-anos-90",
  ]);
});

Deno.test("discoverArticleUrls descarta outras páginas utilitárias de 1 palavra nunca vistas antes (prova que o filtro generaliza, não é só uma lista de palavras)", () => {
  const links = [
    "https://exemplo-noticias.com.br/cadastro",
    "https://exemplo-noticias.com.br/carrinho",
    "https://exemplo-noticias.com.br/minha-conta", // 2 palavras, mas ainda não é matéria — aceitável falso-positivo raro
    "https://exemplo-noticias.com.br/2026/08/matéria-real",
  ];
  const result = discoverArticleUrls(source, links);
  assertEquals(result.includes("https://exemplo-noticias.com.br/cadastro"), false);
  assertEquals(result.includes("https://exemplo-noticias.com.br/carrinho"), false);
  assertEquals(result.includes("https://exemplo-noticias.com.br/2026/08/matéria-real"), true);
});

// Defesa em profundidade (achado ao revisar a correção do Sympla/Ingresse/
// WeGoOut): independe do campo content_source — rejeita qualquer URL com
// cara de venda de ingresso, mesmo se a fonte estiver mal configurada.
Deno.test("discoverArticleUrls descarta URL de domínio de ticketing conhecido, mesmo que pareça um slug de artigo válido", () => {
  const sympla = { url: "https://www.sympla.com.br/", name: "Sympla" };
  const links = [
    "https://www.sympla.com.br/evento/festa-de-fim-de-ano-2026/3413113",
    "https://www.sympla.com.br/2026/08/matéria-real-que-nao-existe",
  ];
  assertEquals(discoverArticleUrls(sympla, links), []);
});

Deno.test("discoverArticleUrls descarta URL com path de ticketing (/evento/, /ingresso/) mesmo em domínio editorial", () => {
  const links = [
    "https://exemplo-noticias.com.br/evento/festa-de-fim-de-ano-2026",
    "https://exemplo-noticias.com.br/ingressos/comprar-agora-promocao",
    "https://exemplo-noticias.com.br/2026/08/matéria-real",
  ];
  assertEquals(discoverArticleUrls(source, links), ["https://exemplo-noticias.com.br/2026/08/matéria-real"]);
});

Deno.test("discoverArticleUrls descarta página de listagem de 1 segmento (ex.: /noticias/, bug real Play BPM)", () => {
  const playBpmSource = { url: "https://playbpm.com.br/", name: "Play BPM" };
  const links = [
    "https://playbpm.com.br/noticias/",
    "https://playbpm.com.br/noticias/artista-lanca-single-inedito",
  ];
  assertEquals(discoverArticleUrls(playBpmSource, links), [
    "https://playbpm.com.br/noticias/artista-lanca-single-inedito",
  ]);
});

Deno.test("discoverArticleUrls descarta outras páginas de listagem de 1 segmento comuns (blog, agenda, eventos)", () => {
  const links = [
    "https://exemplo-noticias.com.br/blog/",
    "https://exemplo-noticias.com.br/agenda",
    "https://exemplo-noticias.com.br/eventos/",
    "https://exemplo-noticias.com.br/2026/08/matéria-real",
  ];
  assertEquals(discoverArticleUrls(source, links), ["https://exemplo-noticias.com.br/2026/08/matéria-real"]);
});

Deno.test("findListingIndexUrls encontra as páginas de listagem de 1 segmento do mesmo domínio (regressão Play BPM)", () => {
  const playBpmSource = { url: "https://playbpm.com.br/", name: "Play BPM" };
  const links = [
    "https://playbpm.com.br/noticias/",
    "https://playbpm.com.br/sobre",
    "https://outro-site.com.br/noticias/",
  ];
  assertEquals(findListingIndexUrls(playBpmSource, links), ["https://playbpm.com.br/noticias/"]);
});

Deno.test("findListingIndexUrls não devolve duplicata (com/sem barra final)", () => {
  const links = ["https://exemplo-noticias.com.br/blog/", "https://exemplo-noticias.com.br/blog"];
  assertEquals(findListingIndexUrls(source, links).length, 1);
});

Deno.test("findListingIndexUrls retorna vazio quando não há página de listagem reconhecível", () => {
  assertEquals(findListingIndexUrls(source, ["https://exemplo-noticias.com.br/2026/08/matéria-real"]), []);
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
