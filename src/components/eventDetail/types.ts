export interface EventDetailData {
  id: string;
  title: string;
  slug: string;
  subtitle?: string | null;
  date: string;
  end_date?: string | null;
  time: string;
  end_time?: string;
  venue: string;
  location_city: string;
  location_state: string;
  genres: string[];
  lineup: string[];
  schedule?: unknown;
  description: string;
  image_url: string;
  ticket_link: string;
  vip_link: string;
  cta_type?: string | null;
  pix_button_enabled?: boolean;
  tickets_per_day?: boolean;
  blog_post_id: string | null;
  views: number;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface RelatedBlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  image_url: string;
  category: string;
  published_at: string;
}
