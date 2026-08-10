/**
 * Contract test (estático) — Fase C3 da reorganização dos controles de
 * publicação (10/08/2026), itens #4/#5/#6: cooldown, streak seco e sorteio
 * justo na seleção de fonte do auto-article-cron. Único bloco mexido —
 * mesmo raciocínio dos outros 3 hotfixes anteriores desse arquivo, testado
 * como conteúdo estático porque o arquivo não é importado por nenhum
 * _test.ts (createClient inline sem generics quebra o type-check de
 * qualquer teste que importe index.ts — ver verify-sources-weekly/discovery.ts
 * pro padrão de extrair lógica pura quando isso importa).
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';

const read = (path: string) => fs.readFileSync(`${process.cwd()}/${path}`, 'utf-8');

describe('Contract: auto-article-cron — cooldown/streak seco/sorteio justo de fonte (Fase C3)', () => {
  const content = read('supabase/functions/auto-article-cron/index.ts');

  it('busca id, content_last_picked_at e content_dry_streak (precisa do id pra atualizar depois)', () => {
    expect(content).toContain("select('id, name, url, content_last_picked_at, content_dry_streak')");
  });

  it('lê o cooldown configurável de site_settings (auto_article_source_cooldown_days)', () => {
    expect(content).toContain('auto_article_source_cooldown_days');
    expect(content).toContain('sourceCooldownDays');
  });

  it('exclui fontes em cooldown, com fallback pra nunca travar a geração (todas excluídas -> exclui só a mais recente)', () => {
    expect(content).toContain('eligibleSources');
    expect(content).toContain('mostRecentlyPicked');
    expect(content).toContain('sourcePool.length === 0');
  });

  it('atualiza content_dry_streak de cada fonte tentada (zera quem achou, incrementa quem não achou)', () => {
    expect(content).toContain('sourceYieldedCandidate');
    expect(content).toContain('content_dry_streak: nextStreak');
  });

  it('alerta (log warn) quando o streak seco cruza o limiar configurado', () => {
    expect(content).toContain('auto_article_dry_streak_alert');
    expect(content).toContain("'warn', 'source-dry-streak'");
  });

  it('só a fonte que gerou com sucesso entra em cooldown (content_last_picked_at)', () => {
    const successBlockIdx = content.indexOf('// ========== SUCESSO ==========');
    expect(successBlockIdx).toBeGreaterThan(-1);
    const successBlock = content.slice(successBlockIdx, successBlockIdx + 1200);
    expect(successBlock).toContain('content_last_picked_at: now.toISOString()');
    expect(successBlock).toContain("eq('id', pickedSource.id)");
  });
});
