/**
 * Regressão real (10/08/2026, Fase 0 de validação do painel de geração de
 * conteúdo): ao gerar via "Sugestões" (tema livre, generate-blog-post-from-topic
 * modo open_search) um artigo cujas fontes reais encontradas eram em espanhol
 * (djmagla.com/laf5.com — cobertura de Nacho Bolognani na Argentina), o artigo
 * saiu inteiro em espanhol — nenhum dos 2 prompts (source_article e
 * open_search) tinha qualquer instrução de idioma. Confirmado corrigido 2x
 * seguidas via geração real (Nacho Bolognani e Camelphat, ambos com fontes só
 * em espanhol, ambos saíram em português após a correção). Ver docs/TESTING.md.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';

const read = (path: string) => fs.readFileSync(`${process.cwd()}/${path}`, 'utf-8');

describe('Regressão: artigo por tema/sugestões sempre em português, mesmo com fontes em outro idioma', () => {
  const content = read('supabase/functions/generate-blog-post-from-topic/index.ts');

  it('os dois prompts (source_article e open_search) exigem português do Brasil', () => {
    const idiomaMatches = content.match(/REGRA CRÍTICA — IDIOMA/g) ?? [];
    const portuguesMatches = content.match(/português do Brasil/g) ?? [];
    // 2 ocorrências = 1 por modo (mode === 'source_article' e o open_search).
    expect(idiomaMatches.length).toBe(2);
    expect(portuguesMatches.length).toBe(2);
  });

  it('a regra de idioma vem antes do bloco de fidelidade/fontes em cada prompt', () => {
    const idiomaIdx = content.indexOf('REGRA CRÍTICA — IDIOMA');
    const fidelidadeIdx = content.indexOf('FIDELIDADE ABSOLUTA À MATÉRIA ORIGINAL');
    const fontesIdx = content.indexOf('FONTES TÊM PRIORIDADE ABSOLUTA');
    expect(idiomaIdx).toBeGreaterThan(-1);
    expect(idiomaIdx).toBeLessThan(fidelidadeIdx);
    expect(idiomaIdx).toBeLessThan(fontesIdx);
  });
});
