// Fase 3 (R-062) — verificação extra antes de liberar um disparo preso.
//
// Problema: se create-event-email-campaign morrer EXATAMENTE entre o POST
// /campaigns/email e a gravação do resultado, a linha fica 'in_progress' e o
// cron heal-stuck-email-dispatches libera o claim do evento — permitindo, em
// tese, uma segunda campanha para o mesmo evento.
//
// Solução: cada campanha criada leva no `internal_name` um marcador estável
// derivado do id da linha de histórico (`[ref:xxxxxxxx]`). Antes de liberar
// qualquer reserva, o cron pergunta à E-goi se já existe campanha com aquele
// marcador. Falha segura: se a E-goi não responder (timeout/erro/resposta
// inesperada), o resultado é 'unknown' e NADA é liberado.
//
// deno-lint-ignore-file no-explicit-any
import { egoiRequest } from './egoiClient.ts';

export const EGOI_DISPATCH_MARKER_PREFIX = 'ref:';

/** Marcador estável e curto o bastante pra caber no internal_name da E-goi. */
export function buildDispatchMarker(historyRowId: string): string {
  return `[${EGOI_DISPATCH_MARKER_PREFIX}${historyRowId.slice(0, 8)}]`;
}

/** Acrescenta o marcador ao internal_name (idempotente). */
export function withDispatchMarker(
  internalName: string,
  historyRowId?: string | null,
): string {
  if (!historyRowId) return internalName;
  const marker = buildDispatchMarker(historyRowId);
  return internalName.includes(marker) ? internalName : `${internalName} ${marker}`;
}

type ListedCampaign = { internal_name?: string; status?: string; campaign_hash?: string };

/** A E-goi responde ora `{ items: [...] }`, ora um array direto. */
export function extractCampaigns(body: unknown): ListedCampaign[] {
  if (Array.isArray(body)) return body as ListedCampaign[];
  const items = (body as any)?.items;
  return Array.isArray(items) ? (items as ListedCampaign[]) : [];
}

export function findCampaignByMarker(
  body: unknown,
  marker: string,
): ListedCampaign | null {
  return (
    extractCampaigns(body).find((c) =>
      typeof c?.internal_name === 'string' && c.internal_name.includes(marker)
    ) ?? null
  );
}

export type DispatchLookup =
  | { result: 'found'; campaign: ListedCampaign }
  | { result: 'not_found' }
  | { result: 'unknown'; reason: string };

const PAGE_SIZE = 100;
const MAX_PAGES = 3;

/**
 * Pergunta à E-goi se já existe campanha para esta linha de histórico.
 * NUNCA lança — na dúvida devolve 'unknown' (o chamador não deve liberar nada).
 */
export async function findEgoiCampaignForDispatch(
  apiKey: string,
  historyRowId: string,
  fetchPage: (path: string) => Promise<{ ok: boolean; status: number; body: any }> = (path) =>
    egoiRequest(path, apiKey),
): Promise<DispatchLookup> {
  const marker = buildDispatchMarker(historyRowId);
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await fetchPage(
        `/campaigns?type=email&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
      );
      if (!res.ok) return { result: 'unknown', reason: `E-goi HTTP ${res.status}` };
      const items = extractCampaigns(res.body);
      const match = findCampaignByMarker(res.body, marker);
      if (match) return { result: 'found', campaign: match };
      if (items.length < PAGE_SIZE) break;
    }
    return { result: 'not_found' };
  } catch (err) {
    return {
      result: 'unknown',
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
