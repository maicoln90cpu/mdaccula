export interface LinkAnalytics {
  id: string;
  title: string;
  url: string;
  clicks: number;
  group_name: string;
  is_internal: boolean;
}

export interface GroupAnalytics {
  group_name: string;
  total_clicks: number;
  link_count: number;
}

export interface EventAnalytics {
  id: string;
  title: string;
  slug: string;
  views: number;
  date: string;
  venue: string;
}

export interface BlogAnalytics {
  id: string;
  title: string;
  slug: string;
  views: number;
  likes: number;
  category: string;
}

export interface RedirectAnalytics {
  id: string;
  slug: string;
  destination_url: string;
  description: string | null;
  clicks: number;
  enabled: boolean;
}

export type TimePeriod = 'today' | '7d' | '30d' | 'all';
