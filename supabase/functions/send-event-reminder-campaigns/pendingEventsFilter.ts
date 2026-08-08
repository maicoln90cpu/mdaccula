// Filtra quais eventos-candidato (na data-alvo) ainda precisam de um
// lembrete disparado — extraído do index.ts para ser testável isoladamente.
//
// Regra: pula quem já tem uma linha 'sent'/'draft' em event_email_campaigns
// (campaign_type='event_reminder'); cada linha 'failed' conta como 1
// tentativa já feita, até MAX_ATTEMPTS. IMPORTANTE: as tentativas são
// contadas pelo NÚMERO DE LINHAS 'failed' (uma por execução que falhou),
// não por uma coluna incrementada — writeDigestCampaignHistory sempre
// insere, nunca faz update, então contar linhas é a única forma correta de
// não deixar retries acontecerem para sempre a cada hora.

export const MAX_EVENT_REMINDER_ATTEMPTS = 3;

export interface PendingEventCandidate {
  id: string;
}

export interface ExistingCampaignRow {
  event_id: string;
  status: string;
}

export function filterPendingReminderEvents<T extends PendingEventCandidate>(
  candidates: T[],
  existingRows: ExistingCampaignRow[],
  maxAttempts: number = MAX_EVENT_REMINDER_ATTEMPTS,
): T[] {
  const statusesByEvent = new Map<string, string[]>();
  for (const row of existingRows) {
    const arr = statusesByEvent.get(row.event_id) ?? [];
    arr.push(row.status);
    statusesByEvent.set(row.event_id, arr);
  }
  return candidates.filter((candidate) => {
    const statuses = statusesByEvent.get(candidate.id) ?? [];
    if (statuses.includes('sent') || statuses.includes('draft')) return false;
    const failedAttempts = statuses.filter((s) => s === 'failed').length;
    return failedAttempts < maxAttempts;
  });
}
