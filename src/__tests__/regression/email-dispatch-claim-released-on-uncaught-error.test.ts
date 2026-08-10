/**
 * R-055 — O evento Sirius ficou "travado" (email_campaign_dispatched_at
 * setado, mas nenhuma campanha criada em event_email_campaigns) depois de
 * uma falha real de produção: o disparo do template "virada de lote" ficava
 * pendurado sem nenhum log de erro, e o próximo clique em "Enviar agora"
 * retornava `dispatch_in_progress` mesmo minutos depois.
 *
 * Causa: o `catch` externo de create-event-email-campaign/
 * create-multi-event-email-campaign logava a exceção (R-052) mas nunca
 * liberava o claim (Guard 3) — só os caminhos de erro EXPLICITAMENTE
 * tratados (E-goi rejeitou, hash ausente, etc.) resetavam
 * `email_campaign_dispatched_at` pra null. Uma falha não prevista (ex.:
 * `fetch()` sem timeout pro Bunny CDN travando até o runtime matar a
 * function) deixava o evento com o claim preso até o timeout de 15s
 * (`DISPATCH_CLAIM_STALE_MS`) — e se a falha se repetisse a cada nova
 * tentativa, o evento ficava perpetuamente bloqueado.
 *
 * Correção composta:
 *  1. O `catch` externo das 2 Edge Functions agora libera o claim antes de
 *     responder 500 (não só os caminhos já tratados).
 *  2. Os `fetch()` sem timeout usados no cache de imagens de mapa (Bunny CDN
 *     + Google Static Maps, via render-static-map) ganharam
 *     `AbortSignal.timeout(...)` — a causa mais provável do travamento
 *     silencioso, já que o Bunny CDN teve avisos reais de timeout/connection
 *     reset nos logs de produção nesse mesmo período.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf-8');

describe('Regressão R-055 — claim de disparo liberado em qualquer falha, fetches de mapa com timeout', () => {
  it('create-event-email-campaign libera o claim no catch externo', () => {
    const src = read('supabase/functions/create-event-email-campaign/index.ts');
    const catchBlock = src.slice(src.lastIndexOf('} catch (e) {'));
    expect(
      catchBlock,
      'O catch externo precisa liberar email_campaign_dispatched_at (claimAdmin/claimEventId) antes do 500 — ' +
        'senão uma falha não prevista deixa o evento travado pra reenvio.'
    ).toMatch(/email_campaign_dispatched_at:\s*null/);
  });

  it('create-multi-event-email-campaign libera o claim dos eventos no catch externo', () => {
    const src = read('supabase/functions/create-multi-event-email-campaign/index.ts');
    const catchBlock = src.slice(src.lastIndexOf('} catch (e) {'));
    expect(
      catchBlock,
      'O catch externo precisa liberar email_campaign_dispatched_at pros eventos claimados antes do 500.'
    ).toMatch(/email_campaign_dispatched_at:\s*null/);
  });

  it('os fetches de Bunny CDN e render-static-map usados no cache de mapas de e-mail têm timeout', () => {
    const bunny = read('supabase/functions/_shared/bunnyUploadBytes.ts');
    const mapCache = read('supabase/functions/_shared/renderStaticMapCache.ts');

    const fetchCallsWithoutTimeout = (src: string) => {
      const matches = [...src.matchAll(/fetch\([^;]*?\)/gs)];
      return matches.filter((m) => !m[0].includes('AbortSignal.timeout'));
    };

    expect(
      fetchCallsWithoutTimeout(bunny),
      'Algum fetch() em bunnyUploadBytes.ts ficou sem AbortSignal.timeout — pode travar a Edge Function ' +
        'indefinidamente se o Bunny CDN não responder (causa raiz do R-055).'
    ).toHaveLength(0);

    expect(
      fetchCallsWithoutTimeout(mapCache),
      'Algum fetch() em renderStaticMapCache.ts ficou sem AbortSignal.timeout.'
    ).toHaveLength(0);
  });
});
