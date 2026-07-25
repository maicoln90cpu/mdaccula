export interface LinkGroup {
  id: string;
  name: string;
  slug: string;
  display_order: number;
  enabled: boolean;
  custom_links?: CustomLink[];
}

export interface CustomLink {
  id: string;
  title: string;
  url: string;
  group_id: string | null;
  thumbnail_url: string | null;
  icon: string;
  color_gradient: string;
  clicks: number;
  enabled: boolean;
  display_order: number;
  is_internal: boolean;
  subtitle?: string | null;
  is_featured?: boolean;
  card_height?: number;
  card_width?: number;
  event_id?: string | null;
  events?: {
    date: string;
    end_date?: string | null;
    time: string;
    end_time?: string | null;
  } | null;
  manual_order_override?: boolean;
}

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Erro desconhecido';
};
