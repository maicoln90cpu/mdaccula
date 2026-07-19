import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { searchWithFirecrawl } from "./firecrawlSearch.ts";

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

Deno.test("searchWithFirecrawl parseia formato data.web[]", async () => {
  const results = await withMockedFetch(
    {
      ok: true,
      body: {
        success: true,
        data: { web: [{ title: "A Liga no Sonora Garden", url: "https://exemplo.com/a-liga", markdown: "conteúdo real" }] },
      },
    },
    () => searchWithFirecrawl("a liga são paulo", "fake-key", 5)
  );

  assertEquals(results.length, 1);
  assertEquals(results[0].url, "https://exemplo.com/a-liga");
  assertEquals(results[0].content, "conteúdo real");
});

Deno.test("searchWithFirecrawl parseia formato data[] (array puro)", async () => {
  const results = await withMockedFetch(
    { ok: true, body: { success: true, data: [{ title: "Solomun SP", url: "https://exemplo.com/solomun", markdown: "texto" }] } },
    () => searchWithFirecrawl("solomun são paulo", "fake-key", 5)
  );

  assertEquals(results.length, 1);
  assertEquals(results[0].title, "Solomun SP");
});

Deno.test("searchWithFirecrawl descarta itens sem markdown ou sem url", async () => {
  const results = await withMockedFetch(
    {
      ok: true,
      body: {
        data: {
          web: [
            { title: "Sem markdown", url: "https://exemplo.com/x" },
            { title: "Sem url", markdown: "conteúdo" },
            { title: "Válido", url: "https://exemplo.com/y", markdown: "conteúdo real" },
          ],
        },
      },
    },
    () => searchWithFirecrawl("termo qualquer", "fake-key", 5)
  );

  assertEquals(results.length, 1);
  assertEquals(results[0].url, "https://exemplo.com/y");
});

Deno.test("searchWithFirecrawl retorna array vazio quando não há resultados (nenhuma fonte real encontrada)", async () => {
  const results = await withMockedFetch(
    { ok: true, body: { success: true, data: { web: [] } } },
    () => searchWithFirecrawl("evento inexistente xyz123", "fake-key", 5)
  );

  assertEquals(results, []);
});

Deno.test("searchWithFirecrawl lança erro em resposta HTTP não-ok", async () => {
  await assertRejects(
    () => withMockedFetch({ ok: false, status: 500, body: { error: "boom" } }, () => searchWithFirecrawl("termo", "fake-key", 5)),
    Error,
    "Firecrawl search HTTP 500"
  );
});
