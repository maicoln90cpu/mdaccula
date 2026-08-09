/**
 * Regressão — Dashboard de e-mails sempre mostrava métricas da E-goi
 * zeradas (achado pelo usuário em conferência ao vivo, 2026-08-09).
 *
 * Causa raiz (em event_email_campaign_stats, confirmado ao vivo): o edge
 * function egoi-campaign-stats chamava GET /campaigns/email/{id}/statistics,
 * um endpoint que não existe na API v3 da E-goi (404 em toda tentativa —
 * confirmado contra os SDKs oficiais Python e Javascript, o path correto é
 * GET /reports/email/{campaign_hash}). Além disso o cron de sincronização
 * (a cada 6h) chamava a função sequencialmente por campanha sem
 * timeout_milliseconds explícito no net.http_post, estourando o timeout
 * padrão de 5s do pg_net antes de completar — mesmo depois de corrigido o
 * endpoint, o cron nunca teria tempo de terminar.
 *
 * O front-end mascarava os dois problemas: refreshAll() tinha um catch vazio
 * (só fail++, sem log), então o usuário via "4 falha(s)" no toast mas não
 * havia nenhuma pista do motivo real em lugar nenhum.
 *
 * Este teste é estático (sem render): garante que o front-end loga o motivo
 * real de cada falha, para não voltar a mascarar um erro de integração como
 * este.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão — refreshAll loga o motivo real de cada falha ao atualizar métricas', () => {
  it('EmailDashboard.tsx importa o logger centralizado', () => {
    const src = read('src/components/admin/EmailDashboard.tsx');
    expect(src).toMatch(/import \{ logger \} from '@\/lib'/);
  });

  it('refreshAll não tem mais um catch vazio — loga erro de rede e erro de resposta', () => {
    const src = read('src/components/admin/EmailDashboard.tsx');
    const fnBlock = src.slice(src.indexOf('const refreshAll = async'), src.indexOf('const filtered =') > -1 ? src.length : src.length);
    expect(
      fnBlock,
      'refreshAll voltou a ter um catch silencioso — isso esconde a causa real quando ' +
        'a integração com a E-goi quebra (ex.: endpoint mudou, 404, timeout).',
    ).toMatch(/logger\.warn\(/);
  });
});

describe('Regressão — egoi-campaign-stats usa o endpoint real da E-goi', () => {
  it('não referencia mais o endpoint quebrado /campaigns/email/{id}/statistics', () => {
    const src = read('supabase/functions/egoi-campaign-stats/index.ts');
    expect(
      src,
      'O endpoint GET /campaigns/email/{id}/statistics não existe na API v3 da E-goi ' +
        '(sempre 404) — o correto é GET /reports/email/{campaign_hash}.',
    ).not.toMatch(/\/statistics`/);
    expect(src).toMatch(/\/reports\/email\//);
  });
});
