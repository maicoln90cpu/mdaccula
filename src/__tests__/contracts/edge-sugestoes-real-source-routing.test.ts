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
  });

  // Hotfix nº4 (R-048, achado em produção): 1 candidato recusado (422) não
  // pode mais derrubar a execução inteira — a fila tenta o próximo candidato
  // (outras matérias/fontes) antes de desistir.
  it('auto-article-cron tenta múltiplos candidatos (fila) antes de desistir da execução', () => {
    const content = read('supabase/functions/auto-article-cron/index.ts');

    expect(content).toContain('attemptQueue');
    expect(content).toContain('CANDIDATES_PER_SOURCE');
    expect(content).toContain('MAX_GENERATE_ATTEMPTS');
    expect(content).toContain('skipped-all-candidates-unusable');
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

  // R-048 (achado em produção): artigo de 1 parágrafo ("Alok domina o
  // Mainstage...", 312 caracteres) passou pela geração sem nenhuma validação
  // de tamanho mínimo real de conteúdo.
  it('generate-blog-post-from-topic rejeita artigo curto demais (piso mínimo de conteúdo real)', () => {
    const content = read('supabase/functions/generate-blog-post-from-topic/index.ts');

    expect(content).toContain('isContentSubstantial');
    expect(content).toContain('../_shared/articleQuality.ts');
  });

  // R-048 (achado em produção): auto-article-cron escolheu "Sympla"
  // (plataforma de venda de ingresso, não fonte de notícia) e reescreveu uma
  // página de evento como se fosse matéria jornalística. event_sources é
  // compartilhada com o Event Watcher — sem content_source, qualquer fonte
  // enabled=true podia ser escolhida, ticketing incluso.
  it('auto-article-cron e generate-blog-suggestions só usam fontes com content_source=true', () => {
    const cronContent = read('supabase/functions/auto-article-cron/index.ts');
    const suggestionsContent = read('supabase/functions/generate-blog-suggestions/index.ts');

    expect(cronContent).toContain("eq('content_source', true)");
    expect(suggestionsContent).toContain("eq('content_source', true)");
  });

  it('auto-article-cron lê auto_publish_auto_cron de site_settings (chave própria, não mais compartilhada)', () => {
    // 10/08/2026 (reorganização dos controles de publicação): antes o cron
    // compartilhava 'suggestions_auto_publish' com o caminho manual
    // "Sugestões→tema", sem controle independente por tipo de geração.
    const content = read('supabase/functions/auto-article-cron/index.ts');

    expect(content).toContain('auto_publish_auto_cron');
    expect(content).toContain('autoCronAutoPublish');
    // A query real (.in('key', [...])) não deve mais listar a chave antiga —
    // só pode sobrar numa linha de comentário explicando a migração.
    const queryBlock = content.slice(content.indexOf(".in('key', ["), content.indexOf(']);'));
    expect(queryBlock).not.toContain('suggestions_auto_publish');
  });

  it('generate-blog-post-from-topic suporta publishImmediately (rascunho opcional)', () => {
    const content = read('supabase/functions/generate-blog-post-from-topic/index.ts');

    expect(content).toContain('body?.publishImmediately');
    // Item #2 (10/08/2026): willPublish combina publishImmediately com a 2ª
    // checagem de qualidade (isContentSubstantial), não é só o parâmetro cru.
    expect(content).toContain('const willPublish = publishImmediately !== false && finalContentSubstantial');
    expect(content).toContain('published: willPublish');
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
    // Reorganização dos controles de publicação (10/08/2026): o toggle único
    // "suggestions_auto_publish" virou 8 toggles por tipo de geração
    // (useAutoPublishSettings), lidos em AIContent2 e passados ao hook já
    // resolvidos como suggestionsTopicAutoPublish/suggestionsTemplateAutoPublish.
    expect(hook).toContain('suggestionsTopicAutoPublish');
    expect(hook).toContain('suggestionsTemplateAutoPublish');
    expect(page).toContain('useAutoPublishSettings');
    expect(page).toContain('auto_publish_suggestions_topic');
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
