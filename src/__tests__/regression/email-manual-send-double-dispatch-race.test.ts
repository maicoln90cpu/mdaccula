/**
 * Regressão — proteção anti-duplo-envio quebrada pelo `force_resend` no
 * Envio Manual (`create-event-email-campaign` e
 * `create-multi-event-email-campaign`).
 *
 * Bug original (auditoria de agosto/2026):
 *   O botão "Enviar agora" do Envio Manual sempre manda `force_resend: true`
 *   (`useEmailDispatch.ts`). No backend, isso fazia um `UPDATE` INCONDICIONAL
 *   zerando `email_campaign_dispatched_at` numa ida ao banco separada, e só
 *   depois tentava o claim atômico (`UPDATE ... WHERE ... IS NULL`) numa
 *   segunda ida. Duas requisições quase simultâneas (2 abas, duplo clique,
 *   retry de rede) podiam intercalar essas duas idas: a requisição B zerava
 *   o claim que a requisição A tinha acabado de conquistar, e as duas
 *   acabavam disparando a MESMA campanha pra lista inteira.
 *
 * Correção:
 *   O reset e o claim viraram uma ÚNICA instrução `UPDATE` atômica. Com
 *   `force_resend`, só reivindica um evento sem claim OU com um claim já
 *   antigo (mais velho que `DISPATCH_CLAIM_STALE_MS`) — nunca um claim
 *   conquistado há poucos segundos por outra requisição em voo. O Postgres
 *   serializa updates concorrentes na mesma linha, então a segunda
 *   requisição só reavalia esse WHERE depois que a primeira já commitou.
 *
 * Este teste é estático (sem rede/banco): lê o código-fonte das duas Edge
 * Functions e garante que o padrão "reset incondicional + claim separado"
 * não volta, e que o claim usa a janela de staleness.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão — claim de disparo de e-mail não tem mais reset incondicional separado do claim', () => {
  const files = [
    'supabase/functions/create-event-email-campaign/index.ts',
    'supabase/functions/create-multi-event-email-campaign/index.ts',
  ];

  for (const file of files) {
    it(`${file}: não faz mais reset incondicional de email_campaign_dispatched_at antes do claim`, () => {
      const src = read(file);
      expect(
        src,
        `${file} voltou a resetar email_campaign_dispatched_at pra null de forma incondicional ` +
          '(numa ida ao banco separada do claim) quando force_resend — isso REINTRODUZ a corrida ' +
          'de duplo-envio: duas requisições quase simultâneas podem disparar a mesma campanha 2x.'
      ).not.toMatch(/if\s*\(forceResend\)\s*\{\s*await admin[\s\S]*?email_campaign_dispatched_at:\s*null/);
    });

    it(`${file}: claim usa UPDATE atômico único com janela de staleness pro force_resend`, () => {
      const src = read(file);
      expect(src).toMatch(/DISPATCH_CLAIM_STALE_MS/);
      expect(src).toMatch(/email_campaign_dispatched_at\.is\.null,email_campaign_dispatched_at\.lt\.\$\{staleClaimBefore\}/);
    });
  }
});
