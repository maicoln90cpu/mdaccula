import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { countNewCandidates } from "./discovery.ts";

const source = { url: "https://exemplo-noticias.com.br/", name: "Exemplo Notícias" };

function withMockedFetch<T>(
  responses: Array<{ ok: boolean; status?: number; body: unknown }>,
  run: () => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  let call = 0;
  globalThis.fetch = (() => {
    const response = responses[Math.min(call, responses.length - 1)];
    call++;
    return Promise.resolve({
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      json: () => Promise.resolve(response.body),
      text: () => Promise.resolve(JSON.stringify(response.body)),
    } as Response);
  }) as typeof fetch;
  return run().finally(() => {
    globalThis.fetch = originalFetch;
  });
}

Deno.test("countNewCandidates conta candidatos novos achados direto na raiz", async () => {
  const count = await withMockedFetch(
    [{ ok: true, body: { data: { links: ["https://exemplo-noticias.com.br/2026/08/materia-real"] } } }],
    () => countNewCandidates(source, [], "fake-key"),
  );
  assertEquals(count, 1);
});

Deno.test("countNewCandidates retorna 0 quando não há nenhuma matéria nova (sem 2º hop possível)", async () => {
  const count = await withMockedFetch(
    [{ ok: true, body: { data: { links: ["https://exemplo-noticias.com.br/sobre"] } } }],
    () => countNewCandidates(source, [], "fake-key"),
  );
  assertEquals(count, 0);
});

Deno.test("countNewCandidates tenta o 2º hop (página de listagem) quando a raiz não tem matéria direta", async () => {
  const count = await withMockedFetch(
    [
      { ok: true, body: { data: { links: ["https://exemplo-noticias.com.br/noticias/"] } } }, // raiz só linka listagem
      { ok: true, body: { data: { links: ["https://exemplo-noticias.com.br/noticias/materia-nova-aqui"] } } }, // 2º hop
    ],
    () => countNewCandidates(source, [], "fake-key"),
  );
  assertEquals(count, 1);
});

Deno.test("countNewCandidates exclui URLs já usadas (usedUrls)", async () => {
  const count = await withMockedFetch(
    [{ ok: true, body: { data: { links: ["https://exemplo-noticias.com.br/2026/08/ja-usada"] } } }],
    () => countNewCandidates(source, ["https://exemplo-noticias.com.br/2026/08/ja-usada"], "fake-key"),
  );
  assertEquals(count, 0);
});

Deno.test("countNewCandidates nunca lança em falha de rede — devolve 0", async () => {
  const count = await withMockedFetch(
    [{ ok: false, status: 500, body: { error: "boom" } }],
    () => countNewCandidates(source, [], "fake-key"),
  );
  assertEquals(count, 0);
});
