import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { stripHtmlTags, isContentSubstantial, MIN_ARTICLE_PLAINTEXT_LENGTH } from "./articleQuality.ts";

Deno.test("stripHtmlTags remove as tags e mantém o texto", () => {
  assertEquals(stripHtmlTags("<h2>Título</h2><p>Texto do parágrafo.</p>"), "Título Texto do parágrafo.");
});

Deno.test("stripHtmlTags decodifica entidades HTML comuns", () => {
  assertEquals(stripHtmlTags("<p>Tom &amp; Jerry &quot;show&quot;</p>"), 'Tom & Jerry "show"');
});

Deno.test("stripHtmlTags colapsa espaços múltiplos", () => {
  assertEquals(stripHtmlTags("<p>a</p>\n\n<p>b</p>"), "a b");
});

// Regressão real: "Alok domina o Mainstage..." saiu com 1 parágrafo (312
// caracteres de HTML, ~280 de texto puro) — precisa ser rejeitado.
Deno.test("isContentSubstantial rejeita artigo de 1 parágrafo (regressão real do Alok)", () => {
  const html =
    "<h2>Alok no Mainstage</h2><p>Na sexta-feira (24), Alok subiu ao Mainstage do Tomorrowland Bélgica para sua segunda apresentação no festival este ano. Diante do maior público de música eletrônica do mundo, o brasileiro entregou um set autoral, intenso e enérgico, com drops vibrantes e uma sequência marcante.</p>";
  assertFalse(isContentSubstantial(html));
});

Deno.test("isContentSubstantial aceita artigo com volume real de texto", () => {
  const paragraph = "Este é um parágrafo com bastante conteúdo real sobre o evento, cobrindo vários detalhes relevantes da matéria. ".repeat(6);
  const html = `<h2>Título</h2><p>${paragraph}</p>`;
  assert(isContentSubstantial(html));
});

Deno.test("isContentSubstantial respeita um limite customizado", () => {
  assert(isContentSubstantial("<p>Texto curto</p>", 5));
  assertFalse(isContentSubstantial("<p>Texto curto</p>", 500));
});

Deno.test("MIN_ARTICLE_PLAINTEXT_LENGTH é o piso padrão usado", () => {
  const html = `<p>${"x".repeat(MIN_ARTICLE_PLAINTEXT_LENGTH - 1)}</p>`;
  assertFalse(isContentSubstantial(html));
  const html2 = `<p>${"x".repeat(MIN_ARTICLE_PLAINTEXT_LENGTH)}</p>`;
  assert(isContentSubstantial(html2));
});
