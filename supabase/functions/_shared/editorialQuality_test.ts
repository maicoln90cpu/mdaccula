import {
  assert,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { EDITORIAL_QUALITY_BLOCK } from "./editorialQuality.ts";

Deno.test("EDITORIAL_QUALITY_BLOCK não está vazio", () => {
  assert(EDITORIAL_QUALITY_BLOCK.trim().length > 0);
});

Deno.test("EDITORIAL_QUALITY_BLOCK proíbe clichês conhecidos", () => {
  assertStringIncludes(EDITORIAL_QUALITY_BLOCK, "experiência única");
  assertStringIncludes(EDITORIAL_QUALITY_BLOCK, "noite inesquecível");
});

Deno.test("EDITORIAL_QUALITY_BLOCK proíbe urgência artificial e emoji no corpo", () => {
  assertStringIncludes(EDITORIAL_QUALITY_BLOCK, "compre AGORA");
  assertStringIncludes(EDITORIAL_QUALITY_BLOCK, "emoji em qualquer parte do artigo");
});

Deno.test("EDITORIAL_QUALITY_BLOCK exige especificidade ancorada em fato", () => {
  assertStringIncludes(EDITORIAL_QUALITY_BLOCK, "DADOS OFICIAIS");
});
