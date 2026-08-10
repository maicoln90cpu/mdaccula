/**
 * Detecta bots/crawlers pelo User-Agent pra excluir da contagem de views.
 * Investigação de 09/08/2026: um único IP (faixa de datacenter Azure) gerava
 * uma "view" em CADA post do blog e CADA evento ativo, todo dia, desde
 * 01/08/2026 — 89% de todas as blog_view_events de um dia típico vinham
 * dessa única origem. track-view nunca olhava o User-Agent, só um rate-limit
 * de 10 req/min/IP (que não impede um crawl lento, 1 request por página).
 *
 * Não bloqueia o bot de acessar a página (bom pra SEO/GEO) — só evita contar
 * a visita como leitura humana nas métricas (blog_posts.views, events.views,
 * blog_view_events, event_view_events, e por consequência o e-mail diário e
 * o Egress Monitor).
 */
const BOT_UA_PATTERN =
  /bot|crawl|spider|slurp|headless|phantom|facebookexternalhit|whatsapp|telegrambot|discordbot|linkedinbot|twitterbot|pingdom|uptimerobot|monitor|preview|lighthouse|curl\/|wget|python-requests|axios\/|go-http-client|okhttp/i;

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? "").trim();
  // Navegador de verdade sempre manda User-Agent numa chamada de fetch —
  // ausência/vazio é mais consistente com script/monitor do que com visita
  // humana, então trata como bot por segurança (evita contar como leitura).
  if (!ua) return true;
  return BOT_UA_PATTERN.test(ua);
}
