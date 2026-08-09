import { assert, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isSelfReferentialSearchQuery } from "./selfReferentialSourceGuard.ts";

const sources = [
  { name: "DJ Mag LA", url: "https://djmagla.com/" },
  { name: "Alataj", url: "https://alataj.com.br/" },
  { name: "Wonderland in Rave", url: "https://wonderlandinrave.com/" },
  { name: "Central DJ", url: "https://www.centraldj.com.br/news/" },
];

Deno.test("bloqueia searchQuery igual ao nome da fonte (regressão do bug real: DJ Mag LA)", () => {
  assert(isSelfReferentialSearchQuery("DJ Mag LA", sources));
});

Deno.test("bloqueia ignorando maiúsculas/acentos (regressão do bug real: Alataj)", () => {
  assert(isSelfReferentialSearchQuery("alataj", sources));
});

Deno.test("bloqueia frase completa igual ao nome (regressão do bug real: Wonderland in Rave)", () => {
  assert(isSelfReferentialSearchQuery("Wonderland In Rave", sources));
});

Deno.test("bloqueia searchQuery igual ao domínio da fonte", () => {
  assert(isSelfReferentialSearchQuery("centraldj", sources));
});

Deno.test("não bloqueia um termo real de notícia extraído do conteúdo da fonte", () => {
  assertFalse(isSelfReferentialSearchQuery("Solomun São Paulo", sources));
});

Deno.test("não bloqueia quando não há fontes cadastradas", () => {
  assertFalse(isSelfReferentialSearchQuery("Alataj", []));
});

Deno.test("não bloqueia searchQuery vazio (não é responsabilidade deste guard)", () => {
  assertFalse(isSelfReferentialSearchQuery("", sources));
});
