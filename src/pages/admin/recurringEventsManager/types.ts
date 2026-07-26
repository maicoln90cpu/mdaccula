export interface RecurringConfig {
  id: string;
  name: string;
  title: string;
  weekday: number;
  venue: string;
  address: string | null;
  location_city: string;
  location_state: string;
  time: string;
  end_time: string | null;
  subtitle: string | null;
  description: string | null;
  genres: string[];
  ticket_link: string | null;
  vip_link: string | null;
  image_url: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  link_group_id: string | null;
}

export interface LinkGroup {
  id: string;
  name: string;
  enabled: boolean;
}

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
