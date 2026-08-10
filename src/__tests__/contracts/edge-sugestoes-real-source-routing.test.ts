/**
 * Contract test (estático) — "Sugestões Aleatórias" deixou de gerar artigos
 * de opinião sem fonte e passou a ancorar cada artigo em matéria real
 * encontrada via busca (Firecrawl `/v1/search`, mesmo padrão de
 * generate-blog-post-from-topic).
 *
 * Ver docs/superpowers/plans/2026-07-15-event-watcher-master-roadmap.md,
 * seção "Sugestões Aleatórias deveria ancorar em matéria real".
 *
 * Atualizado em R-048 (Fase 1, docs/TESTING.md): o caminho 100% automático
 * (auto-article-cron) foi além de "ancorar numa busca" — agora reescreve
 * fielmente 1 matéria individual real e específica de uma fonte cadastrada,
 * em vez de sintetizar uma busca aberta na web. generate-blog-suggestions
 * (a busca "ancorada" original) segue existindo só pro caminho manual.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';

const read = (path: string) => fs.readFileSync(`${process.cwd()}/${path}`, 'utf-8');

describe('Contract: Sugestões ancoradas em matéria real', () => {
  // R-048 (Fase 1, ver docs/TESTING.md): o caminho 100% automático deixou de
  // gerar "sugestões" a partir de homepage raspada — agora descobre e escolhe
  // 1 matéria individual real de uma fonte cadastrada e chama
  // generate-blog-post-from-topic em mode: 'source_article' pra reescrevê-la
  // fielmente. generate-blog-suggestions (busca aberta) continua existindo,
  // só que agora serve exclusivamente o caminho manual (Sugestões/Por Tema).
  it('auto-article-cron descobre e escolhe 1 matéria real de event_sources, sem passar por generate-blog-suggestions', () => {
    const content = read('supabase/functions/auto-article-cron/index.ts');

    expect(content).toContain('/functions/v1/generate-blog-post-from-topic');
    expect(content).not.toContain('/functions/v1/generate-blog-suggestions');
    expect(content).toContain("mode: 'source_article'");
    expect(content).toContain('discoverArticleUrls');
    expect(content).toContain('pickArticleUrl');
    // O lookup do template "Sugestões" ficou sem uso e não deve voltar.
    expect(content).not.toContain("category', 'Sugestões'");
    expect(content).not.toContain('/functions/v1/generate-blog-post-v2');
  });

  it('auto-article-cron exclui matérias já usadas antes (dedupe contra ai_generated_posts.source_urls)', () => {
    const content = read('supabase/functions/auto-article-cron/index.ts');

    expect(content).toContain("from('ai_generated_posts')");
    expect(content).toContain('source_urls');
    expect(content).toContain('usedUrls');
  });

  // R-048 (achado em produção): a raiz de várias fontes só linka pra páginas
  // de listagem (ex.: "/noticias/"), sem matéria individual visível — sem o
  // 2º hop, o cron "gera e não dá certo" (skip silencioso toda vez).
  it('auto-article-cron tenta um 2º hop em páginas de listagem quando a raiz não tem candidato', () => {
    const content = read('supabase/functions/auto-article-cron/index.ts');

    expect(content).toContain('findListingIndexUrls');
  });

  it("auto-article-cron trata 'matéria específica não deu certo' (404/422) como skip, não como falha", () => {
    const content = read('supabase/functions/auto-article-cron/index.ts');

    expect(content).toContain("generateResponse.status === 404 || generateResponse.status === 422");
    expect(content).toContain('skipped-source-article-unusable');
  });

  it("auto-article-cron trata 'nenhuma matéria nova encontrada' como skip, não como falha", () => {
    const content = read('supabase/functions/auto-article-cron/index.ts');

    expect(content).toContain('skipped-no-new-articles');
  });

  it('generate-blog-post-from-topic suporta mode: source_article (reescrita fiel de 1 matéria)', () => {
    const content = read('supabase/functions/generate-blog-post-from-topic/index.ts');

    expect(content).toContain("body?.mode === 'source_article'");
    expect(content).toContain('scrapeArticleContent');
    expect(content).toContain('insufficientSources');
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
    // Onda Bônus: handlers migraram para o hook useSuggestionActions.ts.
    const hook = read('src/pages/admin/aiContent/useSuggestionActions.ts');
    const page = read('src/pages/admin/AIContent2.tsx');

    expect(hook).toContain('isSugestoesCatchAll');
    expect(hook).toContain('generate-blog-post-from-topic');
    expect(hook).toContain('suggestionsAutoPublish');
    expect(page).toContain('suggestionsAutoPublish');
  });

  it('eventos/festivais/lançamentos não ficam mais presos ao template sem fonte real', () => {
    // Regressão: sugestões dessas categorias (geradas por IA em generate-blog-suggestions,
    // sem lineup/data/venue reais) caíam em generate-blog-post-v2 sem busca de fontes,
    // com risco de inventar detalhes de evento. Devem cair no catch-all ancorado em
    // busca real, igual ao cron automático já faz para toda categoria.
    // Onda Bônus: TEMPLATE_ROUTED_CATEGORIES migrou para aiContent/types.ts.
    const content = read('src/pages/admin/aiContent/types.ts');
    const match = content.match(/const TEMPLATE_ROUTED_CATEGORIES = (\[[^\]]*\]);/);
    expect(match).not.toBeNull();

    const routedCategories = JSON.parse(match![1].replace(/'/g, '"')) as string[];
    expect(routedCategories).not.toContain('eventos');
    expect(routedCategories).not.toContain('festivais');
    expect(routedCategories).not.toContain('lançamentos');
    expect(routedCategories).not.toContain('lancamentos');
  });
});
