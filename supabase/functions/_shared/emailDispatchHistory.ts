// R-062 — grava a INTENÇÃO de disparo em event_email_campaigns (status
// 'in_progress') ANTES de qualquer chamada de rede à E-goi, e finaliza a
// MESMA linha depois (sent/draft/failed/scheduled). Com isso, "claim setado
// em events.email_campaign_dispatched_at sem nenhuma linha de histórico"
// deixa de ser um estado alcançável — mesmo se a Edge Function morrer sem
// lançar nenhuma exceção JS (timeout de plataforma, abort de cliente), classe
// de falha que os catches de R-055/R-057/R-058/R-059 não conseguem capturar,
// porque não existe nenhum catch/finally pra rodar. Uma linha presa em
// 'in_progress' por mais de HISTORY_IN_PROGRESS_STALE_MS vira um sinal seguro
// e inequívoco de "isso nunca chegou a ser confirmado na E-goi" (a linha só é
// criada antes de qualquer contato com a E-goi) — ver
// heal-stuck-email-dispatches, que consome esse sinal. Usado por
// create-event-email-campaign e create-multi-event-email-campaign — extraído
// aqui pra não duplicar essa lógica pela 5ª vez entre os dois (R-055, R-057,
// R-058 e R-059 tiveram que ser replicados manualmente nos dois arquivos).
//
// deno-lint-ignore-file no-explicit-any
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const HISTORY_IN_PROGRESS_STALE_MS = 5 * 60_000;

/**
 * Fase 1 (caso single-event) — grava uma linha `in_progress`, reaproveitando
 * `reuseRowId` (via UPDATE) quando fornecido, ou inserindo uma linha nova.
 */
export async function beginInProgressHistoryRow(
  admin: SupabaseClient,
  payload: Record<string, unknown>,
  reuseRowId?: string | null,
): Promise<{ id: string | null; error: string | null }> {
  if (reuseRowId) {
    const { data, error } = await (admin.from('event_email_campaigns') as any)
      .update({ ...payload, status: 'in_progress', egoi_campaign_id: null, error_message: null })
      .eq('id', reuseRowId)
      .select('id')
      .maybeSingle();
    if (error) return { id: null, error: error.message };
    if (data) return { id: data.id as string, error: null };
    // A linha reaproveitável sumiu entre a leitura original e aqui — cai pro insert abaixo.
  }

  const { data, error } = await (admin.from('event_email_campaigns') as any)
    .insert({ ...payload, status: 'in_progress', egoi_campaign_id: null, error_message: null })
    .select('id')
    .single();
  if (error) return { id: null, error: error.message };
  return { id: (data?.id as string) ?? null, error: null };
}

/**
 * Fase 1 (caso multi-evento) — insere N linhas `in_progress`, uma por
 * payload, sempre novas (create-multi-event-email-campaign nunca reaproveita
 * linha — cada disparo aparece individualmente no histórico).
 */
export async function beginInProgressHistoryRows(
  admin: SupabaseClient,
  payloads: Array<Record<string, unknown>>,
): Promise<{ ids: string[]; error: string | null }> {
  const { data, error } = await (admin.from('event_email_campaigns') as any)
    .insert(
      payloads.map((p) => ({ ...p, status: 'in_progress', egoi_campaign_id: null, error_message: null })),
    )
    .select('id');
  if (error || !data) return { ids: [], error: error?.message ?? 'Falha ao gravar linha(s) de histórico' };
  return { ids: (data as Array<{ id: string }>).map((r) => r.id), error: null };
}

/** Fase 2 — finaliza uma única linha já existente (sent/draft/failed/scheduled). */
export async function finalizeHistoryRow(
  admin: SupabaseClient,
  rowId: string,
  payload: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const { error } = await (admin.from('event_email_campaigns') as any).update(payload).eq('id', rowId);
  return { error: error?.message ?? null };
}

/** Fase 2 (caso multi-evento) — finaliza N linhas de uma vez com o mesmo payload. */
export async function finalizeHistoryRows(
  admin: SupabaseClient,
  rowIds: string[],
  payload: Record<string, unknown>,
): Promise<{ error: string | null }> {
  const { error } = await (admin.from('event_email_campaigns') as any).update(payload).in('id', rowIds);
  return { error: error?.message ?? null };
}
