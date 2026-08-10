/**
 * Item #1 (reorganização dos controles de publicação, 10/08/2026): antes,
 * só o caminho 100% automático (mode: 'source_article') buscava imagem real
 * (og:image + Firecrawl) — "Por Tema"/"Sugestões" (mode: 'open_search'),
 * que também raspam páginas reais, caíam direto pra imagem gerada por IA.
 * Passa a tentar a mesma camada de imagem real sobre a 1ª fonte encontrada,
 * só caindo pra IA se isso não achar nada.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';

const read = (path: string) => fs.readFileSync(`${process.cwd()}/${path}`, 'utf-8');

describe('Regressão: imagem real também no modo open_search (Por Tema/Sugestões)', () => {
  const content = read('supabase/functions/generate-blog-post-from-topic/index.ts');

  it('tenta resolveArticleImage também quando mode=open_search (não só source_article)', () => {
    const imageSectionIdx = content.indexOf('// 6) Imagem de capa');
    expect(imageSectionIdx).toBeGreaterThan(-1);
    const imageSection = content.slice(imageSectionIdx);

    expect(imageSection).toContain("FIRECRAWL_API_KEY && (mode === 'source_article' || sourceUrls.length > 0)");
    expect(imageSection).toContain('resolveArticleImage(referenceUrl, referenceName, searchTerm, FIRECRAWL_API_KEY)');
  });

  it('só cai pra IA (LOVABLE_API_KEY) se a imagem real não foi resolvida', () => {
    const imageSectionIdx = content.indexOf('// 6) Imagem de capa');
    const imageSection = content.slice(imageSectionIdx);
    expect(imageSection).toContain("mode === 'open_search' && !imageResolvedFromRealSource && generateImage && LOVABLE_API_KEY");
  });

  it('mode source_article nunca usa IA pra imagem, mesmo com generateImage=true (guardrail original preservado)', () => {
    const imageSectionIdx = content.indexOf('// 6) Imagem de capa');
    const imageSection = content.slice(imageSectionIdx);
    // A condição do fallback de IA exige mode === 'open_search' explicitamente
    // — source_article nunca entra nesse bloco, independente de generateImage.
    const aiBlockIdx = imageSection.indexOf("mode === 'open_search' && !imageResolvedFromRealSource");
    expect(aiBlockIdx).toBeGreaterThan(-1);
  });
});
