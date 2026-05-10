import {
  assertEquals,
  assert,
  assertFalse,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { sanitizeTitle, validateTitle } from "./titleSanitizer.ts";

Deno.test("sanitizeTitle remove emojis", () => {
  assertEquals(
    sanitizeTitle("☀️ Sun no Arena Canindé este sábado"),
    "Sun no Arena Canindé este sábado",
  );
  assertEquals(
    sanitizeTitle("👁️ Dunya invade Espaço Taal em Barueri neste sábado"),
    "Dunya invade Espaço Taal em Barueri neste sábado",
  );
});

Deno.test("sanitizeTitle remove prefixos hediondos", () => {
  assertEquals(
    sanitizeTitle("Confira: Tantrarosa toma a Varanda Estaiada"),
    "Tantrarosa toma a Varanda Estaiada",
  );
  assertEquals(
    sanitizeTitle("Não perca o Dr. Lektroluv no High Club"),
    "o Dr. Lektroluv no High Club",
  );
});

Deno.test("validateTitle reporta título com emoji + separador + data", () => {
  const r = validateTitle("☀️ Sun | 19/09 | Arena Canindé, São Paulo");
  assertFalse(r.valid);
  assert(r.issues.includes("contém emoji"));
  assert(r.issues.includes("contém separador '|'"));
  assert(r.issues.includes("contém data literal DD/MM"));
});

Deno.test("validateTitle aceita título editorial limpo", () => {
  const r = validateTitle("Tantrarosa toma a Varanda Estaiada neste sábado em SP");
  assert(r.valid, `esperava válido, issues: ${r.issues.join(", ")}`);
});

Deno.test("validateTitle rejeita títulos curtos demais", () => {
  const r = validateTitle("Sun");
  assertFalse(r.valid);
  assert(r.issues.some((i) => i.includes("curto")));
});

Deno.test("validateTitle rejeita títulos com travessão mecânico", () => {
  const r = validateTitle("Industria apresenta Dr. Lektroluv — High Club, São Paulo");
  assertFalse(r.valid);
  assert(r.issues.some((i) => i.includes("' — '")));
});
