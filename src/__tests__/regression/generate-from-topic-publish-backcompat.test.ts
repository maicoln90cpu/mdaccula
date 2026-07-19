/**
 * Regressão — `generate-blog-post-from-topic` ganhou suporte a
 * `publishImmediately` (rascunho opcional) pra atender o novo fluxo de
 * "Sugestões Aleatórias" ancoradas em matéria real. Antes dessa mudança a
 * function sempre publicava direto (`published: true` hardcoded).
 *
 * O único chamador pré-existente (`AIContent2.tsx`, aba "Por Tema" —
 * `handleGenerateFromTopic`) depende desse comportamento sempre-publica e
 * NUNCA deve passar `publishImmediately`, senão passaria a nascer como
 * rascunho sem que o usuário tenha pedido isso.
 *
 * Ver docs/superpowers/plans/2026-07-15-event-watcher-master-roadmap.md.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão — generate-blog-post-from-topic mantém sempre-publica pro chamador antigo', () => {
  it('handleGenerateFromTopic (aba Por Tema) não passa publishImmediately', () => {
    const content = read('src/pages/admin/AIContent2.tsx');

    const fnMatch = content.match(/const handleGenerateFromTopic = async[\s\S]*?\n  \};/);
    expect(
      fnMatch,
      'Não encontrei a função handleGenerateFromTopic em AIContent2.tsx.'
    ).toBeTruthy();

    const snippet = fnMatch![0];
    expect(snippet).toContain('generate-blog-post-from-topic');
    expect(
      snippet,
      'handleGenerateFromTopic passou a enviar publishImmediately. ' +
        "Isso REGRIDE o comportamento sempre-publica da aba 'Por Tema' " +
        '(o artigo passaria a nascer como rascunho sem o usuário ter pedido).'
    ).not.toContain('publishImmediately');
  });

  it('generate-blog-post-from-topic preserva publish:true quando publishImmediately é omitido', () => {
    const content = read('supabase/functions/generate-blog-post-from-topic/index.ts');

    expect(content).toContain('const publishImmediately = body?.publishImmediately;');
    expect(content).toContain('published: publishImmediately === false ? false : true');
  });
});
