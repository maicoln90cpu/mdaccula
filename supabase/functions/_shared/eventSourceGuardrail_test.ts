import {
  assert,
  assertFalse,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { shouldRequireSourceVerification, buildGuardrailSearchQuery } from "./eventSourceGuardrail.ts";

Deno.test("shouldRequireSourceVerification liga em modo evento sem sinal real (regressão R-018)", () => {
  assert(shouldRequireSourceVerification(true, false));
});

Deno.test("shouldRequireSourceVerification não liga quando há sinal real (evento do site, multi-evento, scan-event-sources)", () => {
  assertFalse(shouldRequireSourceVerification(true, true));
});

Deno.test("shouldRequireSourceVerification não liga fora do modo evento (templates editoriais)", () => {
  assertFalse(shouldRequireSourceVerification(false, false));
});

Deno.test("buildGuardrailSearchQuery combina eventName e eventLocation", () => {
  assertEquals(buildGuardrailSearchQuery("a liga", "são paulo"), "a liga são paulo");
});

Deno.test("buildGuardrailSearchQuery funciona só com eventName (eventLocation ausente)", () => {
  assertEquals(buildGuardrailSearchQuery("solomun"), "solomun");
});

Deno.test("buildGuardrailSearchQuery ignora eventLocation vazio", () => {
  assertEquals(buildGuardrailSearchQuery("a liga", ""), "a liga");
});
