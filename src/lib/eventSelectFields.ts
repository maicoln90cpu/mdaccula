/**
 * Fonte única de campos do SELECT para a tabela `events` no frontend público.
 *
 * Use SEMPRE esta constante em vez de string literal nos `.select(...)`.
 * Motivo: quando cada tela mantém sua própria string, é fácil esquecer uma
 * coluna nova (ex.: `description`, `subtitle`, `schedule`). O bug clássico é
 * "o dado está no banco mas não aparece na tela" — porque o SELECT não pediu.
 *
 * Regras:
 * - Inclui TODAS as colunas que qualquer componente público pode renderizar
 *   (modal, card, página de detalhe, cards relacionados).
 * - Não inclui colunas sensíveis/internas (`created_by`, `merged_*`).
 * - Para queries de admin que precisam de tudo, use `.select("*")`.
 *
 * Protegido por:
 * - src/__tests__/lib/eventSelectFields.test.ts (campos obrigatórios)
 * - src/__tests__/architecture/event-select-fields.test.ts (uso obrigatório)
 */
export const EVENT_PUBLIC_FIELDS =
  "id, title, subtitle, slug, venue, address, location_city, location_state, " +
  "date, end_date, time, end_time, genres, lineup, description, schedule, " +
  "ticket_link, vip_link, pix_button_enabled, tickets_per_day, image_url, " +
  "views, blog_post_id, status, ai_context, latitude, longitude, " +
  "created_at, updated_at";

/**
 * Campos mínimos que TODO componente público depende.
 * Se algum sumir de EVENT_PUBLIC_FIELDS, o teste unitário quebra.
 */
export const EVENT_REQUIRED_FIELDS = [
  "id",
  "title",
  "subtitle",
  "slug",
  "venue",
  "address",
  "date",
  "end_date",
  "time",
  "description",
  "schedule",
  "pix_button_enabled",
  "tickets_per_day",
] as const;
