/**
 * Regressão — o cron de "Lembrete de evento" (event_reminder_cron, roda de
 * hora em hora) nunca disparava porque `send-event-reminder-campaigns` não
 * tinha entrada em `supabase/config.toml`. Sem essa entrada, o gateway do
 * Supabase cai no padrão `verify_jwt: true` e bloqueia a chamada do cron
 * (que só manda `x-cron-secret`, sem JWT) com 401 antes do código da
 * function rodar — confirmado ao vivo via logs em 2026-08-09.
 *
 * Teste estático (sem render/rede): garante que a entrada continua em
 * config.toml, igual ao padrão já testado pra apify-instagram-webhook.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão — send-event-reminder-campaigns não fica bloqueada no gateway (verify_jwt)', () => {
  it('config.toml expõe send-event-reminder-campaigns com verify_jwt = false', () => {
    const content = read('supabase/config.toml');
    expect(
      content,
      'Sem essa entrada, o gateway do Supabase exige JWT (padrão) e bloqueia a chamada do ' +
        'cron (x-cron-secret, sem JWT) com 401 antes do código da function rodar — o "Lembrete ' +
        'de evento" nunca dispara sozinho.',
    ).toMatch(/\[functions\.send-event-reminder-campaigns\]\s*\nverify_jwt = false/);
  });
});
