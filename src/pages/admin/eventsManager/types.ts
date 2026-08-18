export interface Event {
  id: string;
  title: string;
  subtitle?: string;
  slug: string;
  venue: string;
  address?: string;
  date: string;
  end_date?: string | null;
  time: string;
  end_time?: string;
  location_city: string;
  location_state: string;
  genres: string[];
  image_url?: string;
  blog_post_id?: string | null;
  description?: string;
  lineup?: string[];
  ticket_link?: string;
  vip_link?: string;
  pix_button_enabled?: boolean;
  views?: number | null;
  status?: string;
  merged_into_id?: string | null;
  merged_at?: string | null;
  is_merge_shell?: boolean;
}

export type StatusFilter = 'todos' | 'ativos' | 'inativos';
export type ArticleFilter = 'todos' | 'sem-artigo' | 'com-artigo';
