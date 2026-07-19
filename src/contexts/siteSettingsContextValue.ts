import { createContext } from 'react';

export interface SiteSettings {
  google_tag_manager_id?: string;
  whatsapp_number?: string;
  whatsapp_link?: string;
  instagram_link?: string;
  soundcloud_link?: string;
  contact_email?: string;
  spotify_playlist_id?: string;
  links_page_avatar_url?: string;
  links_page_handle?: string;
  links_page_theme?: string;
  links_page_card_border?: string;
  links_page_card_shadow?: string;
  links_page_card_roundedness?: string;
  links_page_card_backdrop?: string;
  links_page_card_hover?: string;
  links_page_card_color?: string;
  links_page_card_border_color?: string;
  links_page_card_default_height?: string;
  links_show_event_date?: string;
  ai_blog_model?: string;
  // Configurações de Timezone
  timezone_offset?: string;
  timezone_name?: string;
  /** @deprecated substituído por event_hours_after_start / event_hours_without_time */
  event_grace_hours?: string;
  event_hours_after_start?: string;
  event_hours_without_time?: string;
  // Newsletter
  newsletter_popup_enabled?: string;
}

export interface SiteSettingsContextType {
  settings: SiteSettings;
  isLoading: boolean;
  error: Error | null;
}

export const SiteSettingsContext = createContext<SiteSettingsContextType | undefined>(undefined);
