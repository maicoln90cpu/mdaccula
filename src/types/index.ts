/**
 * Tipos compartilhados para o projeto MDAccula
 * Centraliza interfaces e types usados em múltiplos arquivos
 */

import type { Json } from '@/integrations/supabase/types';
import type { EventCtaType } from '@shared/eventCta.ts';

// ============================================
// Tipos de Erro
// ============================================

/**
 * Erro genérico com mensagem
 */
export interface AppError {
  message: string;
  code?: string;
  details?: string;
}

/**
 * Erro de sync log
 */
export interface SyncError {
  table?: string;
  error: string;
}

// ============================================
// Tipos de Prompt Template
// ============================================

export interface PromptRequiredFields {
  [key: string]: boolean;
}

// ============================================
// Tipos de Eventos
// ============================================

export interface Event {
  id: string;
  title: string;
  slug: string;
  subtitle?: string | null;
  date: string;
  end_date?: string | null;
  time: string;
  end_time?: string | null;
  venue: string;
  address?: string | null;
  location_city: string;
  location_state: string;
  genres: string[];
  lineup?: string[] | null;
  description?: string | null;
  image_url?: string | null;
  ticket_link?: string | null;
  vip_link?: string | null;
  cta_type?: EventCtaType | string | null;
  views?: number | null;
  blog_post_id?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  ai_context?: string | null;
  status?: string;
  latitude?: number | null;
  longitude?: number | null;
  venue_lat?: number | null;
  venue_lng?: number | null;
  schedule?: unknown;
  pix_button_enabled?: boolean;
  tickets_per_day?: boolean;
  dispatch_email_on_save?: boolean;
  email_campaign_dispatched_at?: string | null;
  geocoded_at?: string | null;
  merged_at?: string | null;
  merged_into_id?: string | null;
}

// ============================================
// Tipos de Links
// ============================================

export interface RawLinkData {
  id: string;
  title: string;
  subtitle?: string | null;
  url: string;
  thumbnail_url: string | null;
  icon: string;
  color_gradient: string | null;
  clicks: number | null;
  enabled: boolean | null;
  is_internal: boolean | null;
  is_featured?: boolean | null;
  display_order: number | null;
  card_height?: number | null;
  card_width?: number | null;
  group_id?: string | null;
  event_id?: string | null;
  override_date?: string | null;
  override_time?: string | null;
  manual_order_override?: boolean | null;
  events?: {
    venue: string;
    location_city: string;
    location_state: string;
    date: string;
    end_date?: string | null;
    time: string;
    image_url?: string | null;
  } | null;
}

// ============================================
// Tipos de Podcast Submissions
// ============================================

export type PodcastSubmissionStatus = 'pending' | 'approved' | 'rejected' | 'contacted';

export interface PodcastSubmission {
  id: string;
  full_name: string;
  city: string;
  phone: string;
  project_name: string;
  project_age: string;
  genre: string;
  has_original_track: boolean;
  original_track_link?: string | null;
  instagram?: string | null;
  spotify?: string | null;
  soundcloud?: string | null;
  tiktok?: string | null;
  email: string;
  project_description: string;
  status: PodcastSubmissionStatus;
  admin_notes?: string | null;
  notification_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface PodcastSubmissionInsert {
  full_name: string;
  city: string;
  phone: string;
  project_name: string;
  project_age: string;
  genre: string;
  has_original_track?: boolean;
  original_track_link?: string;
  instagram?: string;
  spotify?: string;
  soundcloud?: string;
  tiktok?: string;
  email: string;
  project_description: string;
}

// ============================================
// Tipos de Event Watcher
// ============================================

export type EventSourceType = 'site' | 'instagram';

export interface EventSource {
  id: string;
  type: EventSourceType;
  name: string;
  url: string;
  description?: string | null;
  enabled: boolean;
  last_scanned_at?: string | null;
  last_seen_post_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventSourceInsert {
  type?: EventSourceType;
  name: string;
  url: string;
  description?: string | null;
  enabled?: boolean;
}

export type EventWatchDraftStatus = 'pending_review' | 'approved' | 'rejected' | 'published';

export interface EventWatchDraft {
  id: string;
  source_id?: string | null;
  status: EventWatchDraftStatus;
  extracted_title: string;
  extracted_date: string;
  extracted_time?: string | null;
  extracted_venue?: string | null;
  extracted_address?: string | null;
  extracted_city?: string | null;
  extracted_state?: string | null;
  extracted_lineup?: string[] | null;
  extracted_ticket_link?: string | null;
  extracted_description?: string | null;
  extracted_confidence: 'high' | 'medium' | 'low';
  source_raw_excerpt?: string | null;
  source_page_url?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  published_event_id?: string | null;
  published_blog_post_id?: string | null;
  created_at: string;
  updated_at: string;
  event_sources?: { name: string; url: string } | null;
}

// ============================================
// Re-export de tipos do Supabase para conveniência
// ============================================

export type { Json };
