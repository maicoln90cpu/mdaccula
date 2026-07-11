/** Contrato único de assunto + preheader para Edge Functions de e-mail. */
export type EmailMetaPlaceholderData = {
  eventTitle?: string;
  dateLabel?: string;
  timeLabel?: string;
  venueName?: string;
  cityState?: string;
  weekendRange?: string;
  weekRange?: string;
  rangeLabel?: string;
  eventsCount?: number | string;
};

export type EmailMeta = {
  subject: string;
  preheader: string;
};

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

const valueMap = (data: EmailMetaPlaceholderData): Record<string, string> => ({
  event_title: data.eventTitle ?? '',
  'event.title': data.eventTitle ?? '',
  date_label: data.dateLabel ?? '',
  'event.date_label': data.dateLabel ?? '',
  time_label: data.timeLabel ?? '',
  'event.time_label': data.timeLabel ?? '',
  venue_name: data.venueName ?? '',
  'event.venue': data.venueName ?? '',
  'event.venue_name': data.venueName ?? '',
  city_state: data.cityState ?? '',
  'event.city_state': data.cityState ?? '',
  weekend_range: data.weekendRange ?? data.rangeLabel ?? '',
  week_range: data.weekRange ?? data.rangeLabel ?? '',
  range_label: data.rangeLabel ?? '',
  events_count: data.eventsCount == null ? '' : String(data.eventsCount),
});

export function resolveEmailPlaceholders(
  template: string | null | undefined,
  data: EmailMetaPlaceholderData,
): string {
  if (!template) return '';
  const values = valueMap(data);
  return String(template).replace(PLACEHOLDER_RE, (match, key: string) => values[key] ?? match).trim();
}

export function buildEmailMeta(
  subjectTemplate: string | null | undefined,
  preheaderTemplate: string | null | undefined,
  data: EmailMetaPlaceholderData,
): EmailMeta {
  return {
    subject: resolveEmailPlaceholders(subjectTemplate, data),
    preheader: resolveEmailPlaceholders(preheaderTemplate, data),
  };
}

export function injectEmailPreheader(html: string, preheader: string): string {
  const escaped = preheader
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const hidden = `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escaped}</div>`;
  if (/<div\s+style="display:none;max-height:0;overflow:hidden;mso-hide:all;">[\s\S]*?<\/div>/i.test(html)) {
    return html.replace(/<div\s+style="display:none;max-height:0;overflow:hidden;mso-hide:all;">[\s\S]*?<\/div>/i, hidden);
  }
  return html.replace(/<body([^>]*)>/i, `<body$1>\n${hidden}`);
}