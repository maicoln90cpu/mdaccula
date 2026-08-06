import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkBunnyFile } from "./bunnyUploadBytes.ts";

function withMockedFetch<T>(impl: typeof fetch, fn: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

Deno.test("checkBunnyFile: retorna 'exists' quando HEAD responde 2xx", async () => {
  const result = await withMockedFetch(
    () => Promise.resolve(new Response(null, { status: 200 })),
    () => checkBunnyFile("email-map-images/foo.png"),
  );
  assertEquals(result, "exists");
});

Deno.test("checkBunnyFile: retorna 'not-found' quando HEAD responde 404 (confirmado ausente)", async () => {
  const result = await withMockedFetch(
    () => Promise.resolve(new Response(null, { status: 404 })),
    () => checkBunnyFile("email-map-images/foo.png"),
  );
  assertEquals(result, "not-found");
});

Deno.test("checkBunnyFile: retorna 'error' em status HTTP inesperado (não confunde com ausente)", async () => {
  const result = await withMockedFetch(
    () => Promise.resolve(new Response(null, { status: 500 })),
    () => checkBunnyFile("email-map-images/foo.png"),
  );
  assertEquals(result, "error");
});

Deno.test("checkBunnyFile: retorna 'error' quando fetch lança (timeout/erro de rede) — não confunde com ausente", async () => {
  const result = await withMockedFetch(
    () => Promise.reject(new TypeError("client error (Connect): tcp connect error")),
    () => checkBunnyFile("email-map-images/foo.png"),
  );
  assertEquals(result, "error");
});
