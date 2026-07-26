/**
 * Tipos e constantes compartilhados do RedirectsManager.
 * Extraído na Onda 11 (slim-down) sem alterações de valores.
 */
export interface RedirectLink {
  id: string;
  slug: string;
  destination_url: string;
  description: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  clicks: number;
  enabled: boolean;
  created_at: string;
}

export interface FormData {
  slug: string;
  destination_url: string;
  description: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
}

export const UTM_SOURCE_OPTIONS = [
  'mdaccula',
  'instagram',
  'whatsapp',
  'facebook',
  'tiktok',
  'email',
  'google',
];

export const UTM_MEDIUM_OPTIONS = [
  'link-curto',
  'bio',
  'stories',
  'email',
  'post',
  'ads',
  'qrcode',
];
