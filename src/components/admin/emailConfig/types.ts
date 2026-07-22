/**
 * Tipos compartilhados entre `EmailConfig.tsx` e componentes filhos
 * (EmailEventsTab, SendNowButton, AbTestButton, …).
 *
 * Extraído do topo de `src/pages/admin/EmailConfig.tsx` para permitir o
 * slim-down por responsabilidade (Fase C do plano).
 */

export type Mode = 'draft' | 'immediate' | 'scheduled' | 'manual';

export type Campaign = {
  id: string;
  event_id: string;
  egoi_campaign_id: string | null;
  status: 'draft' | 'scheduled' | 'sent' | 'failed';
  mode: Mode;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  campaign_type?: string | null;
  ab_group_id?: string | null;
  ab_variant?: string | null;
  ab_test_config?: Record<string, unknown> | null;
  /** Segmento E-goi usado neste envio (null = toda a lista). */
  segment_id?: number | null;
  events?: { title: string | null } | null;
  /** Agendamento de disparo (aba "Envio manual" → "Agendar"). */
  scheduled_at?: string | null;
  scheduled_send_attempts?: number;
};

export type CampaignStats = {
  sent: number;
  delivered: number;
  opens_unique: number;
  clicks_unique: number;
  bounces: number;
  unsubscribes: number;
  open_rate: number;
  click_rate: number;
  fetched_at?: string;
};

export type CampaignStatsMap = Record<string, CampaignStats>;

export type AutomationCfg = {
  enabled: boolean;
  day: number;
  hour: number;
  templateId: string;
  sendOnCron?: boolean;
};

export type AutomationResult = {
  egoi_campaign_id?: string | null;
  events_count?: number;
  posts_count?: number;
  range?: string;
} | null;

export type EgoiConfig = {
  id?: string;
  list_id: number | null;
  sender_id: number | null;
  segment_id: number | null;
  mode: Mode;
  is_enabled: boolean;
  scheduled_days_before: number;
  default_event_template_id?: string | null;
};

export type ListItem = {
  list_id: number;
  internal_name?: string;
  public_name?: string;
  total_contacts?: number | null;
};

export type SenderItem = {
  sender_id: number;
  name?: string;
  email?: string;
};

export type SegmentItem = {
  segment_id: number;
  name: string;
  total_contacts?: number | null;
};
