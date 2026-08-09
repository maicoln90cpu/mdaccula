// Registra em event_email_campaigns uma linha por evento incluído numa
// campanha de digest/agenda (weekly-digest-draft, weekend-agenda-draft),
// espelhando o padrão de create-multi-event-email-campaign/index.ts
// (N linhas compartilhando o mesmo egoi_campaign_id) — é isso que faz cada
// evento aparecer individualmente como "enviado" na aba Histórico e
// controle (EmailEventsTab.tsx), mesmo quando o e-mail de fato foi um
// digest/agenda cobrindo vários eventos de uma vez.
//
// Propositalmente NÃO faz claim de events.email_campaign_dispatched_at —
// diferente do multi-event manual, digests são recorrentes e cobrem faixas
// de datas que se sobrepõem; um claim aqui bloquearia permanentemente
// envios individuais futuros do mesmo evento. Esta função só grava
// visibilidade no histórico, sem dedup nem proteção de corrida.
//
// Sem eventos (blog-digest-draft, que não é ligado a evento nenhum, ou uma
// semana "quieta" de weekly/weekend sem nenhum evento no período) grava UMA
// linha com event_id = null, em vez de não gravar nada — antes disso, um
// digest sem eventos ficava permanentemente invisível no Dashboard, mesmo
// quando o e-mail tinha sido realmente criado/enviado na E-goi (bug real,
// achado em 2026-08-09: era por isso que a automação Blog news nunca
// aparecia em métrica nenhuma).

export interface DigestCampaignHistoryOpts {
  campaignHash: string | null;
  status: 'draft' | 'sent' | 'failed';
  mode: 'draft' | 'immediate';
  errorMessage: string | null;
  sentAt: string | null;
  campaignType: string;
  segmentId: number | null;
}

/**
 * Nunca lança — falha ao gravar histórico não pode derrubar a resposta do
 * digest/agenda. Retorna uma mensagem de aviso quando o insert falha, ou
 * `null` quando tudo certo.
 */
export async function writeDigestCampaignHistory(
  // deno-lint-ignore no-explicit-any
  admin: any,
  eventIds: string[],
  opts: DigestCampaignHistoryOpts,
): Promise<string | null> {
  const rowBase = {
    egoi_campaign_id: opts.campaignHash,
    status: opts.status,
    mode: opts.mode,
    error_message: opts.errorMessage,
    sent_at: opts.sentAt,
    segment_id: opts.segmentId,
    campaign_type: opts.campaignType,
  };
  const rows = eventIds.length > 0
    ? eventIds.map((eventId) => ({ event_id: eventId, ...rowBase }))
    : [{ event_id: null, ...rowBase }];
  try {
    const { error } = await admin.from('event_email_campaigns').insert(rows);
    if (error) return `Aviso: falha ao gravar histórico: ${error.message}`;
    return null;
  } catch (e) {
    return `Aviso: falha ao gravar histórico: ${(e as Error).message}`;
  }
}
