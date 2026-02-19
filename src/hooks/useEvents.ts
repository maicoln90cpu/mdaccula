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
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("date", { ascending: true });

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
