/**
 * R-085 (Fase 3) — verificação extra na E-goi antes de liberar um disparo preso.
 *
 * Cenário do bug: create-event-email-campaign morre EXATAMENTE entre o POST
 * /campaigns/email e a gravação do resultado. A linha fica 'in_progress' e o
 * cron heal-stuck-email-dispatches liberava o claim do evento — permitindo
 * uma segunda campanha para o mesmo evento.
 *
 * Regra garantida aqui:
 *   - campanha existe na E-goi  → 'found'      (cron NÃO libera)
 *   - campanha não existe       → 'not_found'  (cron pode liberar)
 *   - E-goi indisponível        → 'unknown'    (falha segura: NÃO libera)
 */
import { describe, it, expect } from 'vitest';
import {
  buildDispatchMarker,
  withDispatchMarker,
  findCampaignByMarker,
  findEgoiCampaignForDispatch,
} from '@shared/egoiCampaignLookup.ts';

const ROW_ID = 'a1b2c3d4-1111-2222-3333-444455556666';
const MARKER = buildDispatchMarker(ROW_ID);

describe('R-085 — verificação E-goi antes de liberar disparo preso', () => {
  it('marcador é estável e idempotente no internal_name', () => {
    expect(MARKER).toBe('[ref:a1b2c3d4]');
    const once = withDispatchMarker('MDAccula • Evento • 2026-08-21', ROW_ID);
    expect(once).toContain(MARKER);
    expect(withDispatchMarker(once, ROW_ID)).toBe(once);
    expect(withDispatchMarker('sem id', null)).toBe('sem id');
  });

  it('casa a campanha pelo marcador, ignorando as outras', () => {
    const body = {
      items: [
        { internal_name: 'MDAccula • Outro • 2026-08-20 [ref:99999999]' },
        { internal_name: `MDAccula • Evento • 2026-08-21 ${MARKER}`, campaign_hash: 'hash-1' },
      ],
    };
    expect(findCampaignByMarker(body, MARKER)?.campaign_hash).toBe('hash-1');
    expect(findCampaignByMarker({ items: [] }, MARKER)).toBeNull();
  });

  it('campanha existe → found (cron não pode liberar)', async () => {
    const res = await findEgoiCampaignForDispatch('key', ROW_ID, async () => ({
      ok: true,
      status: 200,
      body: { items: [{ internal_name: `X ${MARKER}`, status: 'sent', campaign_hash: 'h' }] },
    }));
    expect(res.result).toBe('found');
  });

  it('campanha não existe → not_found', async () => {
    const res = await findEgoiCampaignForDispatch('key', ROW_ID, async () => ({
      ok: true,
      status: 200,
      body: { items: [{ internal_name: 'nada a ver' }] },
    }));
    expect(res.result).toBe('not_found');
  });

  it('E-goi com erro HTTP → unknown (falha segura)', async () => {
    const res = await findEgoiCampaignForDispatch('key', ROW_ID, async () => ({
      ok: false,
      status: 503,
      body: 'oops',
    }));
    expect(res.result).toBe('unknown');
  });

  it('E-goi inacessível (exceção/timeout) → unknown, nunca lança', async () => {
    const res = await findEgoiCampaignForDispatch('key', ROW_ID, async () => {
      throw new Error('timeout');
    });
    expect(res).toEqual({ result: 'unknown', reason: 'timeout' });
  });

  it('cron consulta a E-goi antes de liberar e mantém a reserva em caso de dúvida', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('supabase/functions/heal-stuck-email-dispatches/index.ts', 'utf8');
    expect(src).toContain('findEgoiCampaignForDispatch');
    expect(src).toMatch(/lookup\.result === 'unknown'[\s\S]{0,400}continue;/);
    // 'found' nunca pode empurrar o evento pra lista de liberação
    const foundBlock = src.slice(src.indexOf("lookup.result === 'found'"), src.indexOf('Lock otimista'));
    expect(foundBlock).not.toContain('eventIdsToRelease.push');
  });
});
