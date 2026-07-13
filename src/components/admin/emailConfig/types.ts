/**
 * Tipos compartilhados entre `EmailConfig.tsx` e componentes filhos
 * (HistoryTab, SendNowButton, AbTestButton, …).
 *
 * Extraído do topo de `src/pages/admin/EmailConfig.tsx` para permitir o
 * slim-down por responsabilidade (Fase C do plano).
 */

export type Mode = "draft" | "immediate" | "scheduled";

export type Campaign = {
  id: string;
  event_id: string;
  egoi_campaign_id: string | null;
  status: "draft" | "scheduled" | "sent" | "failed";
  mode: Mode;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
  campaign_type?: string | null;
  ab_group_id?: string | null;
  ab_variant?: string | null;
  ab_test_config?: Record<string, unknown> | null;
  events?: { title: string | null } | null;
};

export type EventGroup = {
  event_id: string;
  title: string;
  total: number;
  last: Campaign;
  items: Campaign[];
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

export type RealEventLite = {
  id: string;
  title: string;
  slug: string;
  date: string;
  time: string;
  venue: string;
  location_city: string;
  location_state: string;
  image_url: string | null;
  description: string | null;
  subtitle: string | null;
  ticket_link: string | null;
  vip_link: string | null;
  blog_post_id: string | null;
  lineup: string[] | null;
  venue_lat: number | null;
  venue_lng: number | null;
};

export type AbTestParams = {
  subjectA: string;
  subjectB: string;
  winnerMetric: "opens" | "clicks";
  sendNow: boolean;
};
