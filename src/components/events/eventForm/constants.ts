/**
 * Constantes e helpers puros compartilhados pelas seções do EventForm.
 * Extraído de src/components/events/EventForm.tsx (Onda 3 PR-A).
 */

export const GENRES = [
  'Techno',
  'House',
  'Tech House',
  'Deep House',
  'Progressive',
  'Trance',
  'Psytrance',
  'Drum & Bass',
  'Dubstep',
  'Trap',
  'Hip Hop',
  'Funk',
  'Sertanejo',
  'Pagode',
  'Samba',
  'Rock',
  'Pop',
  'Eletrônica',
  'EDM',
  'Open Format',
  'Festival',
  'Outros',
];

export const STATES = [
  'SP',
  'RJ',
  'MG',
  'RS',
  'PR',
  'SC',
  'BA',
  'GO',
  'PE',
  'CE',
  'PA',
  'MA',
  'PB',
  'ES',
  'PI',
  'AL',
  'RN',
  'MT',
  'MS',
  'DF',
  'SE',
  'RO',
  'TO',
  'AC',
  'AM',
  'RR',
  'AP',
];

/**
 * Normaliza URLs antes de salvar: garante protocolo https:// para qualquer domínio
 * digitado sem ele (ex: sympla.com.br/x, bit.ly/x). Mantém em sincronia com
 * src/lib/safeExternalUrl.ts (defesa em runtime).
 */
export const normalizeUrl = (url: string | undefined): string | undefined => {
  if (!url) return url;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('sms:')
  ) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

export interface EventFormData {
  title: string;
  venue: string;
  address?: string;
  location_state: string;
  location_city: string;
  venue_lat?: number | null;
  venue_lng?: number | null;
  date: string;
  end_date?: string;
  time: string;
  end_time?: string;
  ticket_link?: string;
  vip_link?: string;
  pix_button_enabled?: boolean;
  tickets_per_day?: boolean;
  cta_type?: import('@shared/eventCta.ts').EventCtaType;
  description?: string;
  slug?: string;
  blog_post_id?: string;
  subtitle?: string;
}
