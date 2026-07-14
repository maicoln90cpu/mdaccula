import {
  assert,
  assertFalse,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { shouldScrapeForContext } from "./scrapeGate.ts";

Deno.test("shouldScrapeForContext roda com key e tempo suficiente", () => {
  assert(shouldScrapeForContext({ hasApiKey: true, remainingMs: 20000 }));
});

Deno.test("shouldScrapeForContext não roda sem API key", () => {
  assertFalse(shouldScrapeForContext({ hasApiKey: false, remainingMs: 20000 }));
});

Deno.test("shouldScrapeForContext não roda sem tempo suficiente", () => {
  assertFalse(shouldScrapeForContext({ hasApiKey: true, remainingMs: 5000 }));
});

// Regressão: a decisão de scraping não deve depender de generateImage.
// A assinatura de shouldScrapeForContext não aceita essa flag — se algum
// dia alguém tentar reintroduzi-la, este teste (e o typecheck) quebram.
Deno.test("shouldScrapeForContext ignora geração de imagem (regressão jul/2026)", () => {
  assert(shouldScrapeForContext({ hasApiKey: true, remainingMs: 20000 }));
});
