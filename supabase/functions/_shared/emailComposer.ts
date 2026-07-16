import {
  renderBlockedTemplate,
  type ArticleSummary,
  type Block,
  type EmailTemplateSettings,
  type EventAnnouncementData,
  type GlobalBlock,
} from "./emailBlocks.ts";
import { buildEmailMeta, type EmailMetaPlaceholderData } from "./emailMeta.ts";

export type EmailTemplateInput = {
  blocks: Block[];
  subject_template?: string | null;
  preheader_template?: string | null;
};

export type EmailCompositionIssue = {
  blockId: string;
  kind: Block["kind"] | "template";
  code: string;
  message: string;
};

export type EmailComposition = {
  html: string;
  subject: string;
  preheader: string;
  event: EventAnnouncementData;
  issues: EmailCompositionIssue[];
};

export type EmailEventRow = {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  date: string;
  time: string;
  venue: string;
  location_city: string;
  location_state: string;
  image_url: string | null;
  description: string | null;
  ticket_link: string | null;
  vip_link: string | null;
  lineup: string[] | null;
  latitude: number | null;
  longitude: number | null;
  venue_lat: number | null;
  venue_lng: number | null;
};

type BuildEventOptions = {
  baseUrl?: string;
  flyerOverrideUrl?: string;
  ticketBatchDeadlineIso?: string;
};

export function applyEmailBlockOverrides(
  blocks: Block[],
  opts: { artworkUrl?: string; defaultLink?: string } = {},
): Block[] {
  const artworkUrl = opts.artworkUrl;
  if (!artworkUrl) return blocks;
  return blocks.map((block) => {
    if (block.kind !== "image_with_link" || block.image_url) return block;
    return {
      ...block,
      image_url: artworkUrl,
      link_url: block.link_url || opts.defaultLink || "",
    };
  });
}

const DEFAULT_BASE_URL = "https://mdaccula.com";

const toFiniteNumber = (...values: Array<number | null | undefined>): number | undefined => {
  for (const value of values) {
    if (value == null) continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

export function buildEventAnnouncementData(event: EmailEventRow, opts: BuildEventOptions = {}): EventAnnouncementData {
  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
  const date = new Date(`${event.date}T${event.time || "00:00"}`);
  const eventUrl = `${baseUrl}/eventos/${event.slug}`;
  return {
    eventTitle: event.title,
    eventSubtitle: event.subtitle?.trim() || undefined,
    flyerUrl: opts.flyerOverrideUrl ?? event.image_url?.trim() ?? "",
    dateLabel: date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }),
    timeLabel: (event.time || "").slice(0, 5) || "22h",
    venueName: event.venue,
    cityState: `${event.location_city}-${event.location_state}`,
    description: event.description?.trim() || "",
    ticketUrl: event.ticket_link?.trim() || eventUrl,
    vipLink: event.vip_link?.trim() || undefined,
    eventUrl,
    agendaUrl: `${baseUrl}/eventos`,
    instagramUrl: "https://instagram.com/mdaccula",
    youtubeUrl: "https://youtube.com/@mdaccula",
    tiktokUrl: "https://tiktok.com/@mdaccula",
    unsubscribeUrl: "[E-GOI_UNSUBSCRIBE_LINK]",
    lineup: Array.isArray(event.lineup) ? event.lineup.map((artist) => String(artist).trim()).filter(Boolean) : [],
    eventStartIso: Number.isNaN(date.getTime()) ? undefined : date.toISOString(),
    ticketBatchDeadlineIso: opts.ticketBatchDeadlineIso,
    venueLat: toFiniteNumber(event.latitude, event.venue_lat),
    venueLng: toFiniteNumber(event.longitude, event.venue_lng),
  };
}

const issue = (block: Block, code: string, message: string): EmailCompositionIssue => ({
  blockId: block.id,
  kind: block.kind,
  code,
  message,
});

const isValidDate = (value: string | undefined) => !!value && !Number.isNaN(new Date(value).getTime());

export function validateEmailBlocks(
  blocks: Block[],
  event: EventAnnouncementData,
  article?: ArticleSummary | null,
  globals?: Map<string, GlobalBlock> | Record<string, GlobalBlock> | null,
): EmailCompositionIssue[] {
  const issues: EmailCompositionIssue[] = [];
  for (const original of blocks) {
    if ((original as Block & { hidden?: boolean }).hidden) continue;
    let block = original;
    if (block.kind === "global_ref") {
      const global = globals instanceof Map ? globals.get(block.global_id) : globals?.[block.global_id];
      if (!global) {
        issues.push(issue(block, "GLOBAL_BLOCK_MISSING", "O bloco global vinculado não existe mais."));
        continue;
      }
      block = { ...global.block, id: original.id } as Block;
      if ((block as Block & { hidden?: boolean }).hidden) continue;
    }

    switch (block.kind) {
      case "hero_image":
        if (!event.flyerUrl?.trim()) issues.push(issue(block, "FLYER_MISSING", "Cadastre o flyer do evento ou oculte o bloco de imagem."));
        break;
      case "title":
        if (!event.eventTitle?.trim()) issues.push(issue(block, "TITLE_MISSING", "O evento precisa de título."));
        break;
      case "subtitle":
        if (!event.eventSubtitle?.trim()) issues.push(issue(block, "SUBTITLE_MISSING", "Preencha o subtítulo do evento ou oculte este bloco."));
        break;
      case "event_meta":
        if (!event.dateLabel || !event.timeLabel || !event.venueName || !event.cityState) issues.push(issue(block, "EVENT_META_MISSING", "Preencha data, hora e local do evento."));
        break;
      case "description":
        if (!event.description?.trim()) issues.push(issue(block, "DESCRIPTION_MISSING", "Preencha a descrição do evento ou oculte este bloco."));
        break;
      case "article_summary":
        if (!article?.title || !article.url) issues.push(issue(block, "ARTICLE_MISSING", "Vincule uma matéria ao evento ou oculte o resumo."));
        break;
      case "cta_button": {
        const url = block.url_field === "vip_link" ? event.vipLink : block.url_field === "event_url" ? event.eventUrl : block.url_field === "custom" ? block.custom_url : event.ticketUrl;
        if (!url?.trim()) issues.push(issue(block, "CTA_URL_MISSING", "Preencha o link usado pelo botão principal."));
        break;
      }
      case "secondary_link": {
        const url = block.url_field === "event_url" ? event.eventUrl : block.url_field === "custom" ? block.custom_url : event.agendaUrl;
        if (!url?.trim()) issues.push(issue(block, "SECONDARY_URL_MISSING", "Preencha o destino do link secundário."));
        break;
      }
      case "image_with_link":
        if (!block.image_url?.trim()) issues.push(issue(block, "IMAGE_MISSING", "Escolha a imagem deste bloco ou oculte-o."));
        if (!block.link_url?.trim()) issues.push(issue(block, "IMAGE_LINK_MISSING", "Preencha o link da imagem."));
        break;
      case "text":
        if (!block.html?.trim()) issues.push(issue(block, "TEXT_MISSING", "Preencha o conteúdo do bloco de texto."));
        break;
      case "social_icons":
        if (!(block.networks || []).some((network) => network.enabled && network.url?.trim())) issues.push(issue(block, "SOCIAL_LINK_MISSING", "Ative ao menos uma rede social com link preenchido."));
        break;
      case "lineup":
        if (!(event.lineup || []).some(Boolean)) issues.push(issue(block, "LINEUP_MISSING", "Preencha o line-up do evento ou oculte este bloco."));
        break;
      case "countdown": {
        const source = block.deadline_source || "today_2359";
        const value = source === "custom" ? block.custom_deadline : source === "event_start" ? event.eventStartIso : source === "batch_deadline" ? event.ticketBatchDeadlineIso : new Date().toISOString();
        if (!isValidDate(value)) issues.push(issue(block, "COUNTDOWN_DATE_MISSING", "Defina uma data válida para a contagem regressiva."));
        break;
      }
      case "static_map":
        if (typeof event.venueLat !== "number" || typeof event.venueLng !== "number") issues.push(issue(block, "MAP_COORDINATES_MISSING", "Geocodifique o local do evento ou oculte o mapa."));
        break;
      case "weekend_grid":
        if (!(event.weekendEvents || []).length) issues.push(issue(block, "WEEKEND_EVENTS_MISSING", "Não há eventos para montar a agenda deste bloco."));
        break;
      case "dedge_block": {
        const hasBlockContent = !!(block.image_url || block.primary_url);
        const hasData = !!(event.dedge?.imageUrl || event.dedge?.primaryUrl || event.dedge?.nights?.some((night) => night.enabled && night.url));
        if (!hasBlockContent && !hasData) issues.push(issue(block, "DEDGE_CONTENT_MISSING", "Configure a imagem ou os links do bloco Dedge."));
        break;
      }
      case "weekly_hero":
        if ((block.source || "first_weekend") === "first_weekend" && !(event.weekendEvents || []).length) issues.push(issue(block, "WEEKLY_HERO_MISSING", "Não há evento para o destaque da semana."));
        else if (!event.flyerUrl || !event.eventTitle) issues.push(issue(block, "WEEKLY_HERO_MISSING", "O destaque precisa de título e imagem."));
        break;
      case "blog_posts_list":
        if (!(event.blogPosts || []).length) issues.push(issue(block, "BLOG_POSTS_MISSING", "Não há matérias para montar este bloco."));
        break;
      default:
        break;
    }
  }
  return issues;
}

export function composeEmail(input: {
  template: EmailTemplateInput;
  event: EventAnnouncementData;
  settings?: EmailTemplateSettings | null;
  article?: ArticleSummary | null;
  globals?: Map<string, GlobalBlock> | Record<string, GlobalBlock> | null;
  metaData?: EmailMetaPlaceholderData;
}): EmailComposition {
  const { template, event, settings, article = null, globals = null } = input;
  const meta = buildEmailMeta(template.subject_template, template.preheader_template, input.metaData ?? {
    eventTitle: event.eventTitle,
    dateLabel: event.dateLabel,
    timeLabel: event.timeLabel,
    venueName: event.venueName,
    cityState: event.cityState,
  });
  const issues = validateEmailBlocks(template.blocks, event, article, globals);
  if (!meta.subject) issues.unshift({ blockId: "template", kind: "template", code: "SUBJECT_MISSING", message: "Preencha o assunto do template." });
  if (template.blocks.length === 0) issues.push({ blockId: "template", kind: "template", code: "BLOCKS_MISSING", message: "Adicione ao menos um bloco ao template." });
  return {
    html: renderBlockedTemplate(template.blocks, event, settings, article, { preview: false, globals, preheader: meta.preheader }),
    subject: meta.subject,
    preheader: meta.preheader,
    event,
    issues,
  };
}
