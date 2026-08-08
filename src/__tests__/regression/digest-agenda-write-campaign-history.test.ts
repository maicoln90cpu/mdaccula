/**
 * Regressão R-033 — Eventos enviados via Digest semanal/Agenda FDS nunca
 * apareciam como "enviados" no histórico.
 *
 * Bug original (agosto/2026):
 *   `weekly-digest-draft/index.ts` e `weekend-agenda-draft/index.ts`
 *   despacham UMA campanha na E-goi cobrindo vários eventos de uma vez,
 *   mas nunca gravavam nada em `event_email_campaigns` — a única fonte da
 *   aba "Histórico e controle". Todo evento que só foi anunciado via
 *   digest/agenda (nunca individualmente) ficava permanentemente marcado
 *   como "pendente", mesmo já tendo sido enviado.
 *
 * Correção:
 *   Novo helper `writeDigestCampaignHistory` (_shared/digestCampaignHistory.ts)
 *   grava uma linha por evento incluído, chamado nos 3 desfechos possíveis
 *   (falha ao criar, falha ao enviar, sucesso) de cada função.
 *
 * Este teste é estático (sem rede): lê o código-fonte e garante que as
 * duas edge functions continuam chamando `writeDigestCampaignHistory` nos
 * 3 pontos, com os `eventIds` derivados de `evs` (não de um array já
 * agrupado/filtrado, que perderia IDs individuais).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe.each([
  ['supabase/functions/weekly-digest-draft/index.ts'],
  ['supabase/functions/weekend-agenda-draft/index.ts'],
])('Regressão R-033 — %s grava histórico de campanha por evento', (filePath) => {
  const src = read(filePath);

  it('importa writeDigestCampaignHistory do helper compartilhado', () => {
    expect(src).toMatch(/import\s*\{\s*writeDigestCampaignHistory\s*\}\s*from\s*'\.\.\/_shared\/digestCampaignHistory\.ts'/);
  });

  it('deriva eventIds de evs (array pré-agrupamento, cobre todos os eventos individuais)', () => {
    expect(src).toMatch(/const eventIds = evs\.map\(\(e\)\s*=>\s*e\.id\)/);
  });

  it('chama writeDigestCampaignHistory nos 3 desfechos (falha ao criar, falha ao enviar, sucesso)', () => {
    const calls = src.match(/writeDigestCampaignHistory\(/g) ?? [];
    expect(
      calls.length,
      `Esperava 3 chamadas a writeDigestCampaignHistory em ${filePath} (falha ao criar campanha, ` +
        `falha ao enviar, sucesso) — encontrei ${calls.length}. Isso REINTRODUZ a regressão R-033 ` +
        '(eventos do digest/agenda somem do histórico).'
    ).toBe(3);
  });

  it('não adiciona claim de events.email_campaign_dispatched_at (fora de escopo por design)', () => {
    expect(
      src,
      'email_campaign_dispatched_at não deve ser tocado nesta function — um claim aqui ' +
        'bloquearia permanentemente envios individuais futuros do mesmo evento (digests cobrem ' +
        'faixas de datas que se sobrepõem).'
    ).not.toMatch(/email_campaign_dispatched_at/);
  });
});
