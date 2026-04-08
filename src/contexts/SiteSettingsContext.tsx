import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  event_grace_hours?: string;
  // Newsletter
  newsletter_popup_enabled?: string;
}

interface SiteSettingsContextType {
  settings: SiteSettings;
  isLoading: boolean;
  error: Error | null;
}

const SiteSettingsContext = createContext<SiteSettingsContextType | undefined>(undefined);

const CACHE_KEY = 'mdaccula-site-settings-cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper to transform array to object
const transformToSettingsObject = (data: { key: string; value: string | null }[]): SiteSettings => {
  const settingsObject: SiteSettings = {};
  data?.forEach((setting) => {
    settingsObject[setting.key as keyof SiteSettings] = setting.value ?? undefined;
  });
  return settingsObject;
};

// Get cached settings from localStorage
const getCachedSettings = (): SiteSettings | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    // Return cache if still valid
    if (Date.now() - timestamp < CACHE_TTL) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
};

// Save settings to localStorage cache
const setCachedSettings = (data: SiteSettings) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch {
    // Silently fail if localStorage is not available
  }
};

export const SiteSettingsProvider = ({ children }: { children: ReactNode }) => {
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {

      // No cache, fetch from database
      const { data, error } = await supabase
        .from("site_settings")
        .select("key, value");

      if (error) throw error;

      const settingsObject = transformToSettingsObject(data || []);
      setCachedSettings(settingsObject);
      
      return settingsObject;
    },
    staleTime: 60 * 60 * 1000, // 60 min - settings change very rarely
    gcTime: 120 * 60 * 1000, // 2h in memory
    // Use localStorage cache as placeholder for instant render
    placeholderData: getCachedSettings,
  });

  return (
    <SiteSettingsContext.Provider 
      value={{ 
        settings: settings || {}, 
        isLoading, 
        error: error as Error | null 
      }}
    >
      {children}
    </SiteSettingsContext.Provider>
  );
};

export const useSiteSettingsContext = (): SiteSettingsContextType => {
  const context = useContext(SiteSettingsContext);
  if (context === undefined) {
    throw new Error("useSiteSettingsContext must be used within a SiteSettingsProvider");
  }
  return context;
};
