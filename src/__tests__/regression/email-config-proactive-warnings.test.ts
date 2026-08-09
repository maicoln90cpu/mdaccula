/**
 * Melhoria — Configuração: avisos proativos (Fase 13 da auditoria de
 * agosto/2026).
 *
 * 1) Badge de aviso também para "Master ON + agência OFF" (antes só
 *    existia o alerta inverso: agência ON + Master OFF).
 * 2) Aviso ativo quando os dados sincronizados da E-goi (lista/segmentos)
 *    têm 7+ dias, já que contagens de contatos desatualizadas podem levar
 *    a configurar um envio com números errados.
 * 3) Card "Teste de disparo" ganhou atalhos reais (deep-link) pras abas
 *    Editor + Preview / Histórico / Envio manual, em vez de só citar os
 *    nomes das abas em texto.
 *
 * Teste estático (sem render): garante que as três peças continuam
 * presentes.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Melhoria — Configuração avisa nos dois sentidos (Master x agência)', () => {
  it('ConfigTab.tsx mostra aviso quando Master está ON e a agência está OFF', () => {
    const src = read('src/components/admin/emailConfig/ConfigTab.tsx');
    expect(src).toMatch(/masterEnabled && !cfg\.is_enabled/);
  });
});

describe('Melhoria — aviso de dados da E-goi desatualizados', () => {
  it('ConfigTab.tsx calcula syncDaysAgo e avisa a partir de 7 dias', () => {
    const src = read('src/components/admin/emailConfig/ConfigTab.tsx');
    expect(src).toMatch(/syncDaysAgo/);
    expect(src).toMatch(/syncIsStale = syncDaysAgo != null && syncDaysAgo >= 7/);
  });
});

describe('Melhoria — card "Teste de disparo" tem atalhos reais entre abas', () => {
  it('ConfigTab.tsx recebe onNavigateToTab e usa nos 3 botões de atalho', () => {
    const src = read('src/components/admin/emailConfig/ConfigTab.tsx');
    expect(src).toMatch(/onNavigateToTab\('editor'\)/);
    expect(src).toMatch(/onNavigateToTab\('eventos'\)/);
    expect(src).toMatch(/onNavigateToTab\('batch'\)/);
  });

  it('EmailConfig.tsx conecta onNavigateToTab ao mesmo handleTabChange usado pelas Tabs', () => {
    const src = read('src/pages/admin/EmailConfig.tsx');
    expect(src).toMatch(/onNavigateToTab=\{handleTabChange\}/);
  });
});
