import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  jsonSuccess,
  jsonError,
  handleCorsPreFlight,
  withTimeout,
  isRateLimited,
  getClientIP,
} from "./index.ts";

Deno.test("handleCorsPreFlight responde OPTIONS com headers CORS", () => {
  const req = new Request("https://x.test/f", { method: "OPTIONS" });
  const res = handleCorsPreFlight(req);
  assert(res !== null);
  assertEquals(res!.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("handleCorsPreFlight retorna null para POST", () => {
  const req = new Request("https://x.test/f", { method: "POST" });
  assertEquals(handleCorsPreFlight(req), null);
});

Deno.test("jsonSuccess retorna envelope success:true por padrão", async () => {
  const res = jsonSuccess({ foo: "bar" });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.foo, "bar");
});

Deno.test("jsonError retorna envelope com success:false", async () => {
  const res = jsonError("deu ruim", 400);
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "deu ruim");
  assertEquals(body.success, false);
});

Deno.test("withTimeout resolve quando a promise termina a tempo", async () => {
  const result = await withTimeout(Promise.resolve(42), 100);
  assertEquals(result, 42);
});

Deno.test("withTimeout rejeita quando a promise demora demais", async () => {
  const slow = new Promise((resolve) => setTimeout(() => resolve(1), 50));
  let threw = false;
  try {
    await withTimeout(slow, 10, "teste-lento");
  } catch (e) {
    threw = true;
    assert(String((e as Error).message).includes("teste-lento"));
  }
  assert(threw);
});

Deno.test("getClientIP lê x-forwarded-for", () => {
  const req = new Request("https://x.test/f", {
    headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
  });
  assertEquals(getClientIP(req), "1.2.3.4");
});

Deno.test("isRateLimited bloqueia após exceder o limite na janela", () => {
  const key = `test-${crypto.randomUUID()}`;
  assertEquals(isRateLimited(key, "scope-a", 2, 60_000), false);
  assertEquals(isRateLimited(key, "scope-a", 2, 60_000), false);
  assertEquals(isRateLimited(key, "scope-a", 2, 60_000), true);
});
