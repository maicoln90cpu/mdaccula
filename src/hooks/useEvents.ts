import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isEventVisible } from "@/lib/eventDateHelper";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import type { Event } from "@/types";

export function useEvents() {
  const { settings, isLoading: settingsLoading } = useSiteSettings();
  const queryClient = useQueryClient();

  const graceHours = parseInt(settings?.event_grace_hours || "6");
  const timezoneOffset = parseInt(settings?.timezone_offset || "-3");

  const query = useQuery({
    queryKey: ["events", graceHours, timezoneOffset],
    queryFn: async (): Promise<Event[]> => {
      // Server-side filter: only events from recent days (grace period)
      const graceDate = new Date();
      graceDate.setDate(graceDate.getDate() - Math.ceil(graceHours / 24) - 1);
      const dateFilter = graceDate.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from("events")
        .select("id, title, subtitle, slug, venue, address, location_city, location_state, date, time, end_time, genres, lineup, ticket_link, vip_link, image_url, views, blog_post_id, created_at, updated_at, description")
        .gte("date", dateFilter)
        .order("date", { ascending: true })
        .limit(50);

      if (error) throw error;

      // Filter visible events based on grace hours and timezone
      const visibleEvents = (data || []).filter((event) =>
        isEventVisible(
          { date: event.date, time: event.time, end_time: event.end_time },
          { graceHours, timezoneOffset }
        )
      );

      return visibleEvents;
    },
    enabled: !settingsLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
  });

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  return {
    events: query.data || [],
    isLoading: query.isLoading || settingsLoading,
    isError: query.isError,
    error: query.error,
    refetch,
  };
}
