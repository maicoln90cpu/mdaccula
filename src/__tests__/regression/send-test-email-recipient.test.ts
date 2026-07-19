/**
 * Regressão R-009 — "Enviar teste" não chegava mais ao destino esperado.
 *
 * Bug original (julho/2026):
 *   `send-test-email/index.ts` usava `to_email` do corpo da requisição (com
 *   fallback pro e-mail do admin logado). No frontend, `EmailConfig.tsx`
 *   declarava um state `testEmail` que nunca tinha `<Input>` vinculado — sempre
 *   vazio — então o destino real acabava sendo o e-mail de autenticação do
 *   admin que clicou no botão, não `contato@mdaccula.com`. Além disso, o
 *   sucesso era decidido só por `resp.ok` do fetch pra Resend, sem checar se a
 *   Resend de fato retornou um ID de mensagem confirmando o envio.
 *
 * Correção:
 *   - `send-test-email/index.ts` fixa o destino em `contato@mdaccula.com`
 *     (mesmo valor de AUTOMATION_TEST_RECIPIENT), ignorando qualquer entrada
 *     do client.
 *   - Sucesso exige `body.id` na resposta da Resend.
 *   - `EmailConfig.tsx`/`sendTestEmail` não envia mais `to_email` e valida
 *     `data.id` antes do toast de sucesso.
 *
 * Este teste é estático (sem rede): lê o código-fonte e garante que essas
 * checagens continuam presentes.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-009 — destino fixo e confirmação de entrega no teste de e-mail', () => {
  it('send-test-email não lê mais to_email do corpo da requisição', () => {
    const src = read('supabase/functions/send-test-email/index.ts');
    expect(
      src,
      'send-test-email voltou a ler to_email do body — isso REINTRODUZ a regressão R-009 ' +
        '(destino controlado pelo client, em vez de fixo em contato@mdaccula.com).'
    ).not.toMatch(/to_email/);
  });

  it('send-test-email tem o destinatário de teste fixo hardcoded', () => {
    const src = read('supabase/functions/send-test-email/index.ts');
    expect(src).toMatch(/const TEST_RECIPIENT\s*=\s*["']contato@mdaccula\.com["']/);
    expect(src).toMatch(/const destination = TEST_RECIPIENT/);
  });

  it('send-test-email exige um ID de mensagem da Resend antes de confirmar sucesso', () => {
    const src = read('supabase/functions/send-test-email/index.ts');
    expect(
      src,
      'A resposta de sucesso da Resend deve ser validada por um ID de mensagem ' +
        '(respBody?.id) — um 2xx sozinho não confirma que o e-mail foi de fato enfileirado ' +
        '(regressão R-009).'
    ).toMatch(/respBody\?\.id/);
    expect(src).toMatch(/id:\s*respBody\.id/);
  });

  it('EmailConfig.tsx (sendTestEmail) não envia mais to_email e valida o ID de retorno', () => {
    const src = read('src/pages/admin/EmailConfig.tsx');
    const fnMatch = src.match(/const sendTestEmail[\s\S]*?\n  };/);
    expect(fnMatch, 'Não encontrei a função sendTestEmail em EmailConfig.tsx.').toBeTruthy();
    const fnSrc = fnMatch![0];
    expect(
      fnSrc,
      'sendTestEmail não deve mais enviar to_email — o backend ignora e fixa o destino.'
    ).not.toMatch(/to_email/);
    expect(
      fnSrc,
      'sendTestEmail precisa validar data?.id antes do toast de sucesso — só checar ausência de ' +
        '`error` não confirma que a Resend retornou um ID de mensagem (regressão R-009).'
    ).toMatch(/data\?\.id/);
  });
});
