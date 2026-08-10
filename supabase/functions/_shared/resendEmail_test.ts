// Regressão: os 3 disparos de egress_alerts até 2026-08-09 (28/07, 07/08,
// 09/08) falharam sempre com "401 Credential not found" porque o envio
// chamava https://connector-gateway.lovable.dev/resend/emails com um
// LOVABLE_API_KEY extra sem credencial associada — endpoint que nenhuma
// outra função do projeto usa. send-test-email/daily-metrics-email já
// enviam com sucesso via api.resend.com direto, só com RESEND_API_KEY.
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildResendEmailRequest } from './resendEmail.ts';

Deno.test('buildResendEmailRequest chama api.resend.com direto (não connector-gateway)', () => {
  const req = buildResendEmailRequest({
    resendApiKey: 'test-key',
    toEmail: 'contato@mdaccula.com',
    subject: '[MDACCULA] Alerta de Egress: spike',
    html: '<p>oi</p>',
  });
  assertEquals(req.url, 'https://api.resend.com/emails');
});

Deno.test('buildResendEmailRequest usa só Authorization Bearer com RESEND_API_KEY', () => {
  const req = buildResendEmailRequest({
    resendApiKey: 'test-key',
    toEmail: 'contato@mdaccula.com',
    subject: 'assunto',
    html: '<p>oi</p>',
  });
  assertEquals(req.headers['Authorization'], 'Bearer test-key');
  assertEquals(req.headers['X-Connection-Api-Key'], undefined);
  assertEquals(Object.keys(req.headers).sort(), ['Authorization', 'Content-Type']);
});

Deno.test('buildResendEmailRequest monta o body com destinatário/assunto/html corretos', () => {
  const req = buildResendEmailRequest({
    resendApiKey: 'test-key',
    toEmail: 'contato@mdaccula.com',
    subject: '[MDACCULA] Alerta de Egress: spike',
    html: '<p>oi</p>',
  });
  assertEquals(req.body.to, ['contato@mdaccula.com']);
  assertEquals(req.body.subject, '[MDACCULA] Alerta de Egress: spike');
  assertEquals(req.body.html, '<p>oi</p>');
  assertEquals(req.body.from, 'MDACCULA Alertas <onboarding@resend.dev>');
});
