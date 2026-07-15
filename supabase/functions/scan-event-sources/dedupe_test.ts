import { assert, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isDuplicateEvent, normalizeTitle } from "./dedupe.ts";

Deno.test("normalizeTitle remove acentos, caixa e pontuação", () => {
  assert(normalizeTitle("Sún Fëst — 2ª Edição!") === normalizeTitle("sun fest 2a edicao"));
});

Deno.test("isDuplicateEvent detecta título igual + mesma data (com acento/caixa diferentes)", () => {
  const existing = [{ title: "Sun Festival", date: "2026-09-19" }];
  assert(isDuplicateEvent({ title: "SUN FÉSTIVAL", date: "2026-09-19" }, existing));
});

Deno.test("isDuplicateEvent não marca duplicado se a data é diferente", () => {
  const existing = [{ title: "Sun Festival", date: "2026-09-19" }];
  assertFalse(isDuplicateEvent({ title: "Sun Festival", date: "2026-09-20" }, existing));
});

Deno.test("isDuplicateEvent não marca duplicado se o título é diferente", () => {
  const existing = [{ title: "Sun Festival", date: "2026-09-19" }];
  assertFalse(isDuplicateEvent({ title: "Moon Festival", date: "2026-09-19" }, existing));
});

Deno.test("isDuplicateEvent retorna false para lista vazia", () => {
  assertFalse(isDuplicateEvent({ title: "Qualquer", date: "2026-01-01" }, []));
});
