/**
 * Fonte única dos rótulos em PT-BR usados para "tipo" de e-mail em toda a
 * rota de Gestão de E-mails. Antes eram mantidos em pelo menos dois mapas
 * literais separados (EmailDashboard.tsx e typeFilter.ts), que já tinham
 * divergido entre si ("Digest" vs "Digest semanal" para o mesmo conceito).
 *
 * Cobre a UNIÃO de dois domínios de chave diferentes que compartilham o
 * mesmo vocabulário de rótulos:
 *  - tipo de TEMPLATE (Template['type'], usado no Editor): event_new,
 *    ticket_batch_multi, event_reminder, etc.
 *  - tipo de CAMPANHA (event_email_campaigns.campaign_type, usado no
 *    Dashboard): standard, ab_test_a, ab_test_b, etc.
 * Cada consumidor só consulta as chaves do seu próprio domínio; manter um
 * único Record evita que os rótulos compartilhados (Digest semanal, Agenda
 * FDS, Blog news, Cortesia, Custom) divirjam de novo.
 */
export const EMAIL_TYPE_LABELS: Record<string, string> = {
  // Domínio de tipo de template
  event_new: 'Evento',
  ticket_batch: 'Virada de lote',
  ticket_batch_multi: 'Virada (multi)',
  event_reminder: 'Lembrete de evento',
  // Domínio de tipo de campanha (event_email_campaigns.campaign_type)
  standard: 'Evento',
  ab_test_a: 'A/B (A)',
  ab_test_b: 'A/B (B)',
  // Compartilhados pelos dois domínios
  weekly_digest: 'Digest semanal',
  weekend_agenda: 'Agenda FDS',
  blog_digest: 'Blog news',
  courtesy: 'Cortesia',
  custom: 'Custom',
};
