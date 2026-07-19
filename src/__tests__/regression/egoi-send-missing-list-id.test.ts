/**
 * Regressão R-004 — "Enviar agora" (Histórico) falhava com E-goi 422
 * list_id.isEmpty.
 *
 * Bug original (julho/2026):
 *   `create-event-email-campaign/index.ts` inclui list_id corretamente na
 *   criação da campanha (POST /campaigns/email), mas a chamada seguinte que
 *   efetivamente dispara o envio (POST .../actions/send) mandava corpo vazio
 *   `{}` — a E-goi rejeita com 422 porque list_id também é exigido nesse
 *   endpoint.
 *
 * Correção:
 *   O corpo da chamada de send passa a incluir list_id: Number(cfg.list_id).
 *
 * Este teste é estático (sem rede): lê o código-fonte da Edge Function e
 * garante que a chamada .../actions/send nunca volte a ser feita com corpo
 * vazio.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-004 — list_id na chamada actions/send da E-goi', () => {
  it('create-event-email-campaign inclui list_id no body do POST actions/send', () => {
    const c = read('supabase/functions/create-event-email-campaign/index.ts');
    const sendCallMatch = c.match(/actions\/send[\s\S]{0,800}/);
    expect(
      sendCallMatch,
      'Não encontrei a chamada .../actions/send em create-event-email-campaign/index.ts.'
    ).toBeTruthy();

    const snippet = sendCallMatch![0];
    expect(
      snippet,
      'A chamada .../actions/send não inclui list_id no body. ' +
        "Isso REINTRODUZ a regressão R-004 (E-goi 422 list_id.isEmpty no botão 'Enviar agora'). " +
        'Veja docs/TESTING.md → Regressões cobertas.'
    ).toMatch(/list_id/);

    // Corpo vazio é exatamente o bug original — nunca mais deve voltar.
    expect(snippet).not.toMatch(/body:\s*JSON\.stringify\(\{\}\)/);
  });
});
