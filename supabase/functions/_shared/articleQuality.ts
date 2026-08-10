/**
 * R-048 (achado em produção, 09/08/2026): "Alok domina o Mainstage do
 * Tomorrowland..." saiu com 1 parágrafo só (312 caracteres) — mesma fonte,
 * mesmo pipeline que em outro artigo ("4x4: guia prático...") produziu
 * 5624 caracteres completos. A instrução de "tamanho proporcional ao
 * material real" (Fase 0) não é um limite confiável sozinha — o modelo às
 * vezes interpreta como licença pra parar depois de 1 parágrafo, mesmo
 * quando a matéria original tem mais material aproveitável. Valida um piso
 * mínimo de conteúdo real (texto puro, sem HTML/markup) antes de aceitar o
 * artigo — abaixo disso, trata como matéria insuficiente (mesmo mecanismo
 * de `insufficientSources`) e o `auto-article-cron` tenta o próximo
 * candidato da fila em vez de publicar um esboço.
 */

export function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ~80-100 palavras de texto real — abaixo disso não é um artigo, é um esboço
// de 1 parágrafo (o caso real observado tinha ~280 caracteres de texto puro).
export const MIN_ARTICLE_PLAINTEXT_LENGTH = 500;

export function isContentSubstantial(
  html: string,
  minLength: number = MIN_ARTICLE_PLAINTEXT_LENGTH
): boolean {
  return stripHtmlTags(html).length >= minLength;
}
