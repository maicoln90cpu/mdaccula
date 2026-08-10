/**
 * Contract test (estático) — item #6 da reorganização dos controles de
 * publicação (10/08/2026): "Artigo consolidado" (Multi-Evento) publicava
 * sempre na hora, sem respeitar nenhum toggle. Passa a aceitar
 * `publishImmediately` (mesma convenção de savePost.ts/generate-blog-post-from-topic)
 * e grava `generation_source: 'multi_evento'` em ai_generated_posts.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';

const read = (path: string) => fs.readFileSync(`${process.cwd()}/${path}`, 'utf-8');

describe('Contract: generate-multi-event-article respeita publishImmediately e grava generation_source', () => {
  const content = read('supabase/functions/generate-multi-event-article/index.ts');

  it('lê publishImmediately do body', () => {
    expect(content).toContain('publishImmediately');
  });

  it('published/published_at seguem a mesma convenção das outras functions (false explícito = rascunho)', () => {
    // Item #2 (10/08/2026): ganhou uma 2ª camada (isContentSubstantial) —
    // published passou a depender de publishImmediately E de willPublish
    // calculado a partir do conteúdo, não mais só do parâmetro isolado.
    expect(content).toContain('const willPublish = publishImmediately !== false && substantial');
    expect(content).toContain('published: willPublish');
    expect(content).toContain("published_at: willPublish ? new Date().toISOString() : null");
  });

  it('grava generation_source: multi_evento no log de IA', () => {
    expect(content).toContain("generation_source: 'multi_evento'");
  });

  it('regeneração (existingPostId) não mexe em published (nunca despublica um post existente por engano)', () => {
    const updateBlock = content.slice(content.indexOf("isRegeneration && existingPostId"), content.indexOf('post = updatedPost'));
    expect(updateBlock).not.toContain('published');
  });
});
