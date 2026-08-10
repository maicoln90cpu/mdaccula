/**
 * Regressão — `generate-blog-post-from-topic` ganhou suporte a
 * `publishImmediately` (rascunho opcional) pra atender o novo fluxo de
 * "Sugestões Aleatórias" ancoradas em matéria real. Antes dessa mudança a
 * function sempre publicava direto (`published: true` hardcoded).
 *
 * Atualizado em 10/08/2026 (reorganização dos controles de publicação):
 * o comportamento "sempre-publica" da aba "Por Tema" era exatamente o bug
 * que o usuário pediu pra corrigir (achado ao revisar os 8 caminhos de
 * geração — 5 deles publicavam sem nenhum controle, "Por Tema" incluída).
 * `handleGenerateFromTopic` agora passa `publishImmediately` calculado a
 * partir do toggle `auto_publish_topic_search` (`useAutoPublishSettings`),
 * default rascunho até o admin ligar. O guard anterior (proibir
 * `publishImmediately`) foi invertido: agora garante que ele SEMPRE é
 * enviado, pra never mais silenciosamente publicar sem controle.
 *
 * Ver docs/superpowers/plans/2026-07-15-event-watcher-master-roadmap.md.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão — generate-blog-post-from-topic mantém sempre-publica pro chamador antigo', () => {
  it('handleGenerateFromTopic (aba Por Tema) sempre passa publishImmediately explícito (nunca mais publica sem controle)', () => {
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
      'handleGenerateFromTopic parou de enviar publishImmediately. Isso REGRIDE ' +
        'pro bug antigo (artigo sempre publica na hora, sem respeitar o toggle ' +
        'auto_publish_topic_search).'
    ).toContain('publishImmediately');
    expect(snippet).toContain('auto_publish_topic_search');
  });

  it('generate-blog-post-from-topic preserva publish:true quando publishImmediately é omitido (compat pro caminho automático)', () => {
    const content = read('supabase/functions/generate-blog-post-from-topic/index.ts');

    expect(content).toContain('const publishImmediately = body?.publishImmediately;');
    expect(content).toContain('published: publishImmediately === false ? false : true');
  });
});
