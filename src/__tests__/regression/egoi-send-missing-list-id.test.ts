/**
 * Regressão R-004 — "Enviar agora" (Histórico) falhava com E-goi 422
 * list_id.isEmpty. Depois (R-024) o mesmo endpoint passou a falhar com 422
 * segments.isEmpty pelo motivo oposto: list_id ok, mas `segments` (objeto
 * obrigatório) nunca era enviado.
 *
 * Bug original R-004 (julho/2026):
 *   `create-event-email-campaign/index.ts` inclui list_id corretamente na
 *   criação da campanha (POST /campaigns/email), mas a chamada seguinte que
 *   efetivamente dispara o envio (POST .../actions/send) mandava corpo vazio
 *   `{}` — a E-goi rejeita com 422 porque list_id também é exigido nesse
 *   endpoint.
 *
 * Bug R-024 (julho/2026): confirmado contra a doc oficial da E-goi
 * (developers.e-goi.com/api/v3 — Campaigns > Email > "Send email message")
 * que `segments` também é um campo OBRIGATÓRIO desse endpoint — nenhum dos
 * 3 call-sites (create-event-email-campaign, send-scheduled-email-campaigns,
 * e o próprio helper egoiClient.ts) enviava esse campo, então todo envio
 * real falhava com 422 segments.isEmpty, inclusive o caso simples "enviar
 * pra lista inteira".
 *
 * Correção:
 *   A montagem do payload de `actions/send` foi consolidada em
 *   `sendEgoiCampaign()` (supabase/functions/_shared/egoiClient.ts) — único
 *   lugar que constrói `{ list_id, segments }`. `create-event-email-campaign`
 *   e `send-scheduled-email-campaigns` chamam essa função em vez de montar o
 *   payload inline (duplicado 3x era exatamente o que causava o mesmo bug
 *   voltar em pontos diferentes — R-004 corrigiu só 1 dos 3).
 *
 * Este teste é estático (sem rede): lê o código-fonte e garante que a
 * chamada .../actions/send nunca mais volte a ser feita sem list_id/segments,
 * e que os dois call-sites não voltem a duplicar essa montagem inline.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-004/R-024 — list_id e segments na chamada actions/send da E-goi', () => {
  it('egoiClient.ts (sendEgoiCampaign) inclui list_id e segments no body do POST actions/send', () => {
    const c = read('supabase/functions/_shared/egoiClient.ts');
    const sendCallMatch = c.match(/actions\/send[\s\S]{0,800}/);
    expect(
      sendCallMatch,
      'Não encontrei a chamada .../actions/send em egoiClient.ts.'
    ).toBeTruthy();

    const snippet = sendCallMatch![0];
    expect(
      snippet,
      'A chamada .../actions/send não inclui list_id no body. ' +
        "Isso REINTRODUZ a regressão R-004 (E-goi 422 list_id.isEmpty no botão 'Enviar agora'). " +
        'Veja docs/TESTING.md → Regressões cobertas.'
    ).toMatch(/list_id/);

    expect(
      snippet,
      'A chamada .../actions/send não inclui segments no body. ' +
        'Isso REINTRODUZ a regressão R-024 (E-goi 422 segments.isEmpty — nenhum envio real completa). ' +
        'Veja docs/TESTING.md → Regressões cobertas.'
    ).toMatch(/segments/);

    // Corpo vazio é exatamente o bug original — nunca mais deve voltar.
    expect(snippet).not.toMatch(/body:\s*JSON\.stringify\(\{\}\)/);
  });

  it('create-event-email-campaign e send-scheduled-email-campaigns usam sendEgoiCampaign (não montam o payload de send inline)', () => {
    const createFn = read('supabase/functions/create-event-email-campaign/index.ts');
    const pollerFn = read('supabase/functions/send-scheduled-email-campaigns/index.ts');

    expect(
      createFn,
      'create-event-email-campaign precisa chamar sendEgoiCampaign(...) em vez de montar o body ' +
        'de actions/send inline — duplicar essa montagem em vários arquivos foi exatamente o que ' +
        'causou o mesmo bug (list_id faltando, depois segments faltando) reaparecer em pontos diferentes.'
    ).toMatch(/sendEgoiCampaign\(/);

    expect(
      pollerFn,
      'send-scheduled-email-campaigns precisa chamar sendEgoiCampaign(...) em vez de montar o body ' +
        'de actions/send inline (mesmo motivo do teste acima).'
    ).toMatch(/sendEgoiCampaign\(/);
  });
});
