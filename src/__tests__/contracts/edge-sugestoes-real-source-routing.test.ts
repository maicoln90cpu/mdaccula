/**
 * Contract test (estático) — "Sugestões Aleatórias" deixou de gerar artigos
 * de opinião sem fonte e passou a ancorar cada artigo em matéria real
 * encontrada via busca (Firecrawl `/v1/search`, mesmo padrão de
 * generate-blog-post-from-topic).
 *
 * Ver docs/superpowers/plans/2026-07-15-event-watcher-master-roadmap.md,
 * seção "Sugestões Aleatórias deveria ancorar em matéria real".
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';

const read = (path: string) => fs.readFileSync(`${process.cwd()}/${path}`, 'utf-8');

describe('Contract: Sugestões ancoradas em matéria real', () => {
  it('auto-article-cron chama generate-blog-post-from-topic com o searchQuery da sugestão', () => {
    const content = read('supabase/functions/auto-article-cron/index.ts');

    expect(content).toContain('/functions/v1/generate-blog-post-from-topic');
    expect(content).toContain('selectedSuggestion.searchQuery');
    // O lookup do template "Sugestões" ficou sem uso e não deve voltar.
    expect(content).not.toContain("category', 'Sugestões'");
    expect(content).not.toContain('/functions/v1/generate-blog-post-v2');
  });

  it("auto-article-cron trata 'sem fontes' (404) como skip, não como falha", () => {
    const content = read('supabase/functions/auto-article-cron/index.ts');

    expect(content).toContain('generateResponse.status === 404');
    expect(content).toContain('skipped-no-sources');
  });

  it('auto-article-cron lê suggestions_auto_publish de site_settings', () => {
    const content = read('supabase/functions/auto-article-cron/index.ts');

    expect(content).toContain('suggestions_auto_publish');
    expect(content).toContain('suggestionsAutoPublish');
  });

  it('generate-blog-post-from-topic suporta publishImmediately (rascunho opcional)', () => {
    const content = read('supabase/functions/generate-blog-post-from-topic/index.ts');

    expect(content).toContain('body?.publishImmediately');
    expect(content).toContain('publishImmediately === false ? false : true');
  });

  it('generate-blog-suggestions exige searchQuery real por sugestão', () => {
    const content = read('supabase/functions/generate-blog-suggestions/index.ts');

    expect(content).toContain('searchQuery');
    expect(content).toContain(
      "required: ['title', 'summary', 'category', 'keywords', 'mood', 'visualElements', 'searchQuery']"
    );
  });

  it('admin (AIContent2) roteia categorias catch-all de Sugestões pra busca real', () => {
    const content = read('src/pages/admin/AIContent2.tsx');

    expect(content).toContain('isSugestoesCatchAll');
    expect(content).toContain('generate-blog-post-from-topic');
    expect(content).toContain('suggestionsAutoPublish');
  });

  it('eventos/festivais/lançamentos não ficam mais presos ao template sem fonte real', () => {
    // Regressão: sugestões dessas categorias (geradas por IA em generate-blog-suggestions,
    // sem lineup/data/venue reais) caíam em generate-blog-post-v2 sem busca de fontes,
    // com risco de inventar detalhes de evento. Devem cair no catch-all ancorado em
    // busca real, igual ao cron automático já faz para toda categoria.
    const content = read('src/pages/admin/AIContent2.tsx');
    const match = content.match(/const TEMPLATE_ROUTED_CATEGORIES = (\[[^\]]*\]);/);
    expect(match).not.toBeNull();

    const routedCategories = JSON.parse(match![1].replace(/'/g, '"')) as string[];
    expect(routedCategories).not.toContain('eventos');
    expect(routedCategories).not.toContain('festivais');
    expect(routedCategories).not.toContain('lançamentos');
    expect(routedCategories).not.toContain('lancamentos');
  });
});
