/**
 * Regressão R-048 — "Geração por Tema" gerava artigo institucional sobre a
 * própria fonte em vez de uma notícia real publicada nela.
 *
 * Confirmado em produção com 4 rascunhos reais: "DJ Mag LA", "Alataj",
 * "Wonderland in Rave" e "Nervous Records" — todos viraram artigos SOBRE o
 * veículo/portal (perfil institucional), não sobre uma matéria publicada lá.
 * Causa: `generate-blog-suggestions` raspa a HOMEPAGE de uma fonte (não uma
 * matéria individual); o `onlyMainContent` de uma homepage é essencialmente
 * branding/navegação, então a única âncora "real" que a IA consegue extrair
 * é o próprio nome da marca — e a busca aberta subsequente
 * (`generate-blog-post-from-topic`) devolve a homepage da própria marca como
 * "fonte real" pra esse termo, fechando o ciclo autorreferente.
 *
 * Ver docs/TESTING.md R-048, plano em
 * C:\Users\maico\.claude-conta3\plans\preciso-de-uma-investigacao-golden-bird.md
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-048 — geração por tema não vira perfil institucional da fonte', () => {
  it('BLOCKED_HOSTNAMES bloqueia o próprio domínio do site', () => {
    const content = read('supabase/functions/_shared/firecrawlSearch.ts');
    const blockMatch = content.match(/const BLOCKED_HOSTNAMES = \[([\s\S]*?)\];/);
    expect(blockMatch, 'Não encontrei BLOCKED_HOSTNAMES em firecrawlSearch.ts.').toBeTruthy();

    const blockedList = blockMatch![1];
    expect(blockedList, 'mdaccula.com saiu do blocklist — reabre risco de autorreferência.').toContain('mdaccula.com');
    expect(blockedList, 'mdaccula.b-cdn.net saiu do blocklist — reabre risco de autorreferência.').toContain(
      'mdaccula.b-cdn.net'
    );
  });

  it('generate-blog-suggestions descarta sugestões cujo searchQuery é o nome/domínio da própria fonte', () => {
    const content = read('supabase/functions/generate-blog-suggestions/index.ts');

    expect(content).toContain('isSelfReferentialSearchQuery');
    expect(content).toContain("from '../_shared/selfReferentialSourceGuard.ts'");
  });

  it('generate-blog-suggestions não usa mais a description da fonte como conteúdo real (fallback silencioso removido)', () => {
    const content = read('supabase/functions/generate-blog-suggestions/index.ts');

    expect(
      content,
      'O fallback silencioso pra description voltou — isso alimentava a IA com uma frase de uma linha rotulada como se fosse conteúdo raspado.'
    ).not.toContain("source.description || 'Fonte de notícias sobre música eletrônica'");
    expect(content).not.toContain("s.description || 'Fonte de notícias'");
  });

  it('generate-blog-post-from-topic recusa gerar artigo quando as fontes são só institucional/homepage', () => {
    const content = read('supabase/functions/generate-blog-post-from-topic/index.ts');

    expect(content).toContain('insufficientSources');
    expect(content).toContain('articleData.insufficientSources');
  });

  it('generate-blog-post-from-topic não força mais um tamanho fixo de artigo (900-1300 palavras)', () => {
    const content = read('supabase/functions/generate-blog-post-from-topic/index.ts');

    expect(
      content,
      'O tamanho fixo voltou — isso empurra a IA a "encher linguiça" quando as fontes reais são poucas/fracas.'
    ).not.toContain('900 a 1300 palavras');
  });
});
