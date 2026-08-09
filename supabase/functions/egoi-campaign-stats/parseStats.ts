/**
 * Normaliza a resposta da E-goi (GET /reports/email/{hash}) num shape estável.
 * Campos reais do schema EmailReportOverall (confirmado no SDK oficial):
 * sends, opens, unique_opens, clicks, unique_clicks, hard_bounces,
 * soft_bounces, complaints, unsubscriptions — mesclados no nível raiz do
 * objeto (allOf), não aninhados. Mantém fallbacks pra nomenclatura antiga
 * só por segurança, caso a E-goi mude o shape sem aviso.
 */
export function parseStats(raw: any) {
  const src = raw?.data ?? raw ?? {};
  const num = (v: any) => (typeof v === 'number' ? v : Number(v ?? 0) || 0);

  const sent = num(src.sends ?? src.total ?? src.sent ?? src.delivered_total);
  const hard_bounces = num(src.hard_bounces);
  const soft_bounces = num(src.soft_bounces);
  const bounces = num(src.bounces ?? src.bounced ?? src.total_bounces ?? hard_bounces + soft_bounces);
  const delivered = num(src.delivered ?? src.total_delivered ?? sent - bounces);
  const opens_unique = num(src.unique_opens ?? src.opens_unique ?? src.opens?.unique);
  const opens_total = num(src.opens ?? src.opens?.total ?? opens_unique);
  const clicks_unique = num(src.unique_clicks ?? src.clicks_unique ?? src.clicks?.unique);
  const clicks_total = num(src.clicks ?? src.clicks?.total ?? clicks_unique);
  const unsubscribes = num(src.unsubscriptions ?? src.unsubscribed ?? src.unsubscribes ?? src.total_unsubscribes);
  const complaints = num(src.complaints ?? src.spam ?? 0);

  const base = delivered || sent || 0;
  const open_rate = base > 0 ? +(opens_unique / base * 100).toFixed(2) : 0;
  const click_rate = base > 0 ? +(clicks_unique / base * 100).toFixed(2) : 0;

  return {
    sent,
    delivered,
    opens_unique,
    opens_total,
    clicks_unique,
    clicks_total,
    bounces,
    unsubscribes,
    complaints,
    open_rate,
    click_rate,
    raw: src,
  };
}
