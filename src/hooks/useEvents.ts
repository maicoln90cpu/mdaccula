import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isEventVisible } from "@/lib/eventDateHelper";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import type { Event } from "@/types";

const EVENTS_CACHE_KEY = 'mdaccula-events-cache';

const getCachedEvents = (): Event[] | null => {
  try {
    const cached = localStorage.getItem(EVENTS_CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached).data;
  } catch {
    return null;
  }
};

const setCachedEvents = (data: Event[]) => {
  try {
    localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
};

export function useEvents() {
  const { settings, isLoading: settingsLoading } = useSiteSettings();
  const queryClient = useQueryClient();

  const graceHours = parseInt(settings?.event_grace_hours || "6");
  const timezoneOffset = parseInt(settings?.timezone_offset || "-3");

  const query = useQuery({
    queryKey: ["events", graceHours, timezoneOffset],
    queryFn: async (): Promise<Event[]> => {
      const graceDate = new Date();
      graceDate.setDate(graceDate.getDate() - Math.ceil(graceHours / 24) - 1);
      const dateFilter = graceDate.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from("events")
        .select("id, title, subtitle, slug, venue, address, location_city, location_state, date, time, end_time, genres, lineup, ticket_link, vip_link, image_url, views, blog_post_id, created_at, updated_at")
        .gte("date", dateFilter)
        .order("date", { ascending: true })
        .limit(50);

      if (error) throw error;

      const visibleEvents = (data || []).filter((event) =>
        isEventVisible(
          { date: event.date, time: event.time, end_time: event.end_time },
          { graceHours, timezoneOffset }
        )
      );

      // Save to localStorage for offline fallback
      setCachedEvents(visibleEvents);
      return visibleEvents;
    },
    enabled: !settingsLoading,
    staleTime: 30 * 60 * 1000, // 30 min - events change rarely
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    // Use localStorage cache as placeholder
    placeholderData: () => getCachedEvents() ?? undefined,
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  return {
    events: query.data || getCachedEvents() || [],
    isLoading: query.isLoading || settingsLoading,
    isError: query.isError,
    error: query.error,
    refetch,
  };
}
