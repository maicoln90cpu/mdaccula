import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Campaign } from '../types';
import {
  QUERY_KEY_PREFIX,
  periodRange,
  type EventEntry,
  type EventLite,
  type PeriodFilter,
} from './helpers';

export function useEmailEventsData(period: PeriodFilter) {
  const range = useMemo(() => periodRange(period), [period]);

  return useQuery({
    queryKey: [QUERY_KEY_PREFIX, period],
    queryFn: async (): Promise<EventEntry[]> => {
      const { data: events, error: evErr } = await supabase
        .from('events')
        .select('id, title, date, time, slug, venue, location_city, location_state')
        .gte('date', range.from)
        .lte('date', range.to)
        .order('date', { ascending: true })
        .order('time', { ascending: true });
      if (evErr) throw evErr;
      const evs = (events ?? []) as EventLite[];
      if (evs.length === 0) return [];

      const ids = evs.map((e) => e.id);
      const { data: campaigns, error: cErr } = await supabase
        .from('event_email_campaigns')
        .select(
          'id, event_id, egoi_campaign_id, status, mode, error_message, sent_at, created_at, ' +
            'campaign_type, ab_group_id, ab_variant, ab_test_config, scheduled_at, scheduled_send_attempts'
        )
        .in('event_id', ids)
        .order('created_at', { ascending: false });
      if (cErr) throw cErr;

      const byEvent = new Map<string, Campaign[]>();
      for (const c of (campaigns ?? []) as unknown as Campaign[]) {
        const arr = byEvent.get(c.event_id);
        if (arr) arr.push(c);
        else byEvent.set(c.event_id, [c]);
      }
      return evs.map((e) => ({ event: e, campaigns: byEvent.get(e.id) ?? [] }));
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}
