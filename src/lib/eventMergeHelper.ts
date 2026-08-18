/**
 * Cálculo puro do "card-vitrine" resultante de uma mesclagem de eventos —
 * extraído de MergeEventsDialog pra ser testável sem mockar Supabase.
 * Nunca muta os eventos recebidos: só lê e retorna um objeto novo.
 */
import { normalizeLineup } from '@/lib/lineupNormalizer';

export interface MergeableEventRow {
  id: string;
  title: string;
  subtitle: string | null;
  venue: string;
  address: string | null;
  location_state: string;
  location_city: string;
  date: string;
  end_date: string | null;
  time: string | null;
  end_time: string | null;
  genres: string[];
  lineup: string[] | null;
  description: string | null;
  ticket_link: string | null;
  vip_link: string | null;
  pix_button_enabled: boolean;
  cta_type: string;
  image_url: string | null;
  views: number | null;
}

export interface MergeChoices {
  title: string;
  imageUrl: string | null;
  ticketsPerDay: boolean;
}

export interface MergeSchedulePartDay {
  date: string;
  time: string | null;
  end_time: string | null;
  lineup: string[];
}

export interface MergeShellPayload {
  title: string;
  subtitle: string | null;
  venue: string;
  address: string | null;
  location_state: string;
  location_city: string;
  date: string;
  end_date: string;
  time: string | null;
  end_time: string | null;
  genres: string[];
  description: string | null;
  schedule: MergeSchedulePartDay[];
  ticket_link: string | null;
  vip_link: string | null;
  pix_button_enabled: boolean;
  tickets_per_day: boolean;
  cta_type: string;
  image_url: string | null;
  views: number;
  blog_post_id: null;
  status: 'active';
  is_merge_shell: true;
}

export function hasDistinctTicketLinks(events: Pick<MergeableEventRow, 'ticket_link'>[]): boolean {
  const links = events.map((e) => (e.ticket_link || '').trim()).filter(Boolean);
  return new Set(links).size > 1;
}

export function buildMergeShellPayload(
  events: MergeableEventRow[],
  seedId: string,
  choices: MergeChoices
): MergeShellPayload {
  const seed = events.find((e) => e.id === seedId);
  if (!seed) {
    throw new Error('Evento base não encontrado entre os eventos selecionados.');
  }

  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  const startDate = sorted[0].date;
  const lastEvent = sorted[sorted.length - 1];
  const endDate =
    lastEvent.end_date && lastEvent.end_date > lastEvent.date ? lastEvent.end_date : lastEvent.date;

  const schedule: MergeSchedulePartDay[] = sorted.map((e) => ({
    date: e.date,
    time: e.time,
    end_time: e.end_time,
    lineup: normalizeLineup(e.lineup),
  }));

  const totalViews = events.reduce((sum, e) => sum + (e.views || 0), 0);
  const sharedTicketLink = choices.ticketsPerDay ? null : seed.ticket_link;

  return {
    title: choices.title,
    subtitle: seed.subtitle,
    venue: seed.venue,
    address: seed.address,
    location_state: seed.location_state,
    location_city: seed.location_city,
    date: startDate,
    end_date: endDate,
    time: seed.time,
    end_time: seed.end_time,
    genres: seed.genres,
    description: seed.description,
    schedule,
    ticket_link: sharedTicketLink,
    vip_link: seed.vip_link,
    pix_button_enabled: seed.pix_button_enabled,
    tickets_per_day: choices.ticketsPerDay,
    cta_type: seed.cta_type,
    image_url: choices.imageUrl,
    views: totalViews,
    blog_post_id: null,
    status: 'active',
    is_merge_shell: true,
  };
}
