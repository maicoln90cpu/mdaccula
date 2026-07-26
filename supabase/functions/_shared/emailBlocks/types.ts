// Tipos + expansão de refs globais. Extraído de emailBlocks.ts sem alterar
// nenhuma definição — apenas reorganizado. API pública reexportada via
// ../emailBlocks.ts (barrel).

export type SocialNetwork = {
  id: string;
  label: string;
  url: string;
  enabled: boolean;
  /** URL de uma imagem pequena (ícone oficial da rede) — usada quando o bloco usa style: "icon". */
  icon_url?: string;
};

export type Align = "left" | "center" | "right";

export interface WeekendEventItem {
  id?: string;
  title: string;
  dayLabel: string;
  timeLabel?: string;
  venue: string;
  cityState?: string;
  imageUrl: string;
  eventUrl: string;
  ticketUrl?: string;
  articleUrl?: string;
  /** CTA custom por evento (ex.: DEDGE = "Enviar Nomes Para Lista"). */
  ctaLabel?: string;
  /** Múltiplos CTAs quando o card representa vários eventos (ex.: DEDGE quinta/sex/sáb/dom). */
  ctas?: Array<{ label: string; url: string; dayLabel?: string; timeLabel?: string }>;
}

export interface DedgeNightConfig { label: string; url: string; enabled: boolean; }

export interface DedgeBlockData {
  imageUrl: string;
  eyebrow?: string;
  title?: string;
  description?: string;
  nights: DedgeNightConfig[];
  primaryUrl?: string;
  primaryLabel?: string;
}

export interface BlogPostItem {
  id?: string;
  title: string;
  excerpt?: string;
  imageUrl?: string;
  url: string;
  publishedLabel?: string;
  category?: string;
}

export interface EventAnnouncementData {
  eventTitle: string;
  eventSubtitle?: string;
  flyerUrl: string;
  dateLabel: string;
  timeLabel: string;
  venueName: string;
  cityState: string;
  description: string;
  ticketUrl: string;
  eventUrl: string;
  agendaUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  tiktokUrl: string;
  unsubscribeUrl: string;
  lineup?: string[];
  eventStartIso?: string;
  ticketBatchDeadlineIso?: string;
  venueLat?: number;
  venueLng?: number;
  weekendEvents?: WeekendEventItem[];
  /** Eventos selecionados manualmente para o bloco `event_grid` (2 colunas) — usado pelo template "Virada de lote (múltiplos eventos)". Nome separado de `weekendEvents` de propósito: são features independentes, não acopladas. */
  gridEvents?: WeekendEventItem[];
  blogPosts?: BlogPostItem[];
  dedge?: DedgeBlockData;
  vipLink?: string;
  /** Rótulo do botão CTA definido pelo `cta_type` do evento (ex.: "Emitir Cortesia"). Só é setado quando o evento não usa o tipo padrão — ver `_shared/eventCta.ts`. */
  ctaLabel?: string;
  /** Link de WhatsApp pro botão "Comprar Sem Taxa via Pix" — só setado quando o evento tem `pix_button_enabled` E `vip_link` (ver `_shared/pixWhatsAppLink.ts`). Ausente = bloco `pix_button` não renderiza. */
  pixWhatsAppUrl?: string;
}

export interface EmailTemplateSettings {
  brand_name?: string;
  logo_url?: string | null;
  primary_color?: string;
  accent_color?: string;
  background_color?: string;
  footer_text?: string;
  cta_label?: string;
  instagram_url?: string | null;
  youtube_url?: string | null;
  tiktok_url?: string | null;
  show_subtitle?: boolean;
  show_description?: boolean;
  show_socials?: boolean;
  show_secondary_link?: boolean;
  secondary_link_label?: string;
  custom_html_header?: string | null;
  custom_html_footer?: string | null;
}

export type Block =
  | { id: string; kind: "header"; logo_height?: number; align?: Align; padding_y?: number; padding_bottom?: number; bg_color?: string }
  | { id: string; kind: "hero_image"; max_width?: number; border_radius?: number; border_color?: string; caption?: string }
  | { id: string; kind: "eyebrow"; text?: string; align?: Align; text_color?: string; bg_style?: "none" | "pill" }
  | { id: string; kind: "title"; align?: Align; text_color?: string; font_size?: number; font_weight?: "bold" | "black"; uppercase?: boolean }
  | { id: string; kind: "subtitle"; align?: Align; text_color?: string; font_size?: number; italic?: boolean }
  | { id: string; kind: "event_meta"; layout?: "columns" | "stacked"; show_icons?: boolean; accent_color?: string }
  | { id: string; kind: "description"; align?: Align; text_color?: string; font_size?: number; line_height?: "compact" | "normal" }
  | { id: string; kind: "article_summary"; show_image?: boolean; layout?: "compact" | "card" }
  | { id: string; kind: "cta_button"; label?: string; url_field?: "ticket_link" | "vip_link" | "event_url" | "custom"; custom_url?: string; align?: Align; full_width?: boolean; bg_style?: "gradient" | "solid"; bg_color?: string; size?: "small" | "medium" | "large"; shape?: "rounded" | "pill" }
  | { id: string; kind: "pix_button"; label?: string; align?: Align; full_width?: boolean }
  | { id: string; kind: "secondary_link"; label?: string; url_field?: "agenda_url" | "event_url" | "custom"; custom_url?: string; align?: Align; variant?: "underline" | "ghost"; text_color?: string }
  | { id: string; kind: "image_with_link"; image_url: string; link_url: string; alt?: string; max_width?: number; align?: Align; border_radius?: number; border_color?: string; caption?: string }
  | { id: string; kind: "divider"; thickness?: number; color?: string; spacing?: "compact" | "normal" | "wide"; width?: "full" | "short" }
  | { id: string; kind: "text"; html: string; align?: Align; text_color?: string; font_size?: number; bg_highlight?: boolean }
  | { id: string; kind: "social_icons"; networks: SocialNetwork[]; style?: "text" | "pill" | "icon"; icon_size?: "small" | "medium"; align?: Align }
  | { id: string; kind: "lineup"; title?: string; layout?: "chips" | "list" | "grid"; align?: Align; title_color?: string; text_color?: string; highlight_headliner?: boolean; section_bg?: boolean }
  | { id: string; kind: "countdown"; label?: string; deadline_source?: "today_2359" | "event_start" | "batch_deadline" | "custom"; custom_deadline?: string; bg_style?: "gradient" | "solid"; bg_color?: string; align?: Align; size?: "large" | "medium" | "minimal"; number_color?: string; show_unit_labels?: boolean }
  | { id: string; kind: "ticker"; messages?: string[]; bg_color?: string; text_color?: string; animation?: "none" | "slide" | "fade"; align?: Align; icon?: "none" | "clock" | "fire" | "bolt"; speed?: "slow" | "normal" | "fast"; shape?: "bar" | "pill" }
  | { id: string; kind: "static_map"; zoom?: number; height?: number; map_style?: "roadmap" | "terrain"; show_address_label?: boolean; border_radius?: number; pin_color?: string; directions_label?: string }
  | { id: string; kind: "weekend_grid"; layout?: "cartaz" | "timeline"; title?: string; eyebrow?: string; show_article_link?: boolean; day_bar_color?: string; align?: Align; show_time?: boolean }
  | { id: string; kind: "event_grid"; title?: string; eyebrow?: string; align?: Align }
  | { id: string; kind: "dedge_block"; override_content?: boolean; image_url?: string; eyebrow?: string; title?: string; description?: string; primary_label?: string; primary_url?: string; button_style?: "dark" | "primary"; card_style?: "featured" | "compact"; show_description?: boolean }
  | { id: string; kind: "weekly_hero"; source?: "first_weekend" | "main_event"; eyebrow?: string; cta_label?: string; show_venue?: boolean; show_cta?: boolean; overlay_intensity?: "soft" | "strong"; align?: Align; accent_color?: string; show_datetime?: boolean }
  | { id: string; kind: "blog_posts_list"; title?: string; eyebrow?: string; max_items?: number; layout?: "list" | "cards"; show_excerpt?: boolean; show_category?: boolean; align?: Align; category_color?: string; show_read_more_link?: boolean }
  | { id: string; kind: "footer"; text?: string; include_unsubscribe?: boolean; align?: Align; text_color?: string; font_size?: number }
  | { id: string; kind: "global_ref"; global_id: string; _cached_name?: string };

/** Bloco global salvo na biblioteca — reutilizável entre templates. */
export type GlobalBlock = {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  block: Block;
};

/**
 * Expande referências a blocos globais para o bloco real.
 * Paridade 1:1 com `src/lib/emailTemplates/blocks.ts`.
 * Se o global não for encontrado, substitui por um texto marcador (não vaza para envio real).
 */
export function expandGlobalRefs(
  blocks: Block[],
  globals: Map<string, GlobalBlock> | Record<string, GlobalBlock> | null | undefined,
): Block[] {
  if (!globals) {
    // Sem catálogo: remove global_refs para não deixarem "" no envio real.
    return blocks.filter((b) => b.kind !== "global_ref");
  }
  const get = (id: string): GlobalBlock | undefined =>
    globals instanceof Map ? globals.get(id) : (globals as Record<string, GlobalBlock>)[id];
  const out: Block[] = [];
  for (const b of blocks) {
    if (b.kind !== "global_ref") { out.push(b); continue; }
    const g = get(b.global_id);
    if (!g) continue; // envio real: pula silenciosamente
    // Preserva o id externo para não conflitar entre templates e propaga a flag
    // `hidden` do wrapper (o usuário oculta a referência no template, não o global).
    const hidden = (b as { hidden?: boolean }).hidden === true;
    out.push({ ...g.block, id: b.id, ...(hidden ? { hidden: true } : {}) } as Block);
  }
  return out;
}

export type ArticleSummary = {
  title: string;
  excerpt: string;
  url: string;
  image_url?: string;
};

export type RenderContext = {
  event: EventAnnouncementData;
  article?: ArticleSummary | null;
  settings: Required<Pick<EmailTemplateSettings,
    "brand_name" | "primary_color" | "accent_color" | "background_color" | "footer_text" | "cta_label"
  >> & Partial<EmailTemplateSettings>;
  preview?: boolean;
  /** Project ID para montar URLs do render-static-map (edge). */
  projectId?: string;
  /** Id do evento usado no weekly_hero — grid deve pulá-lo para não duplicar. */
  heroEventId?: string;
};
