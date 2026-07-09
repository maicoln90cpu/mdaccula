/**
 * B.6 — Dispara criação de rascunho de e-mail na E-goi para um evento.
 *
 * Fluxo:
 *  1. Carrega egoi_config (para descobrir template padrão).
 *  2. Carrega template ativo (email_templates) + settings de marca (email_template_settings).
 *  3. Renderiza o HTML no client (reutiliza renderBlockedTemplate).
 *  4. Chama a edge function `create-event-email-campaign` (que aplica os guards
 *     de master switch, config habilitada e anti-race no evento).
 *
 * Retorna o payload da edge function para o chamador exibir toast.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  renderBlockedTemplate,
  type Template,
  type Block,
} from "./blocks";
import {
  renderEventAnnouncementEmail,
  type EventAnnouncementData,
  type EmailTemplateSettings,
} from "./eventAnnouncement";

export type DispatchEventDraftResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  status?: string;
  egoi_campaign_id?: string | null;
  error?: string | null;
};

type EventRow = {
  id: string;
  title: string;
  subtitle?: string | null;
  slug: string;
  date: string;
  time?: string | null;
  venue: string;
  location_city: string;
  location_state: string;
  image_url?: string | null;
  description?: string | null;
  ticket_link?: string | null;
  vip_link?: string | null;
  blog_post_id?: string | null;
};

const BASE_URL = "https://mdaccula.com";

async function buildEventData(ev: EventRow): Promise<EventAnnouncementData> {
  const dateObj = new Date(`${ev.date}T${ev.time || "00:00"}`);
  const dateLabel = dateObj.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const timeLabel = (ev.time || "").slice(0, 5) || "22h";

  return {
    eventTitle: ev.title,
    eventSubtitle: ev.subtitle ?? undefined,
    flyerUrl: ev.image_url || `${BASE_URL}/placeholder.svg`,
    dateLabel,
    timeLabel,
    venueName: ev.venue,
    cityState: `${ev.location_city}-${ev.location_state}`,
    description: ev.description || "",
    ticketUrl: ev.ticket_link || `${BASE_URL}/eventos/${ev.slug}`,
    eventUrl: `${BASE_URL}/eventos/${ev.slug}`,
    agendaUrl: `${BASE_URL}/eventos`,
    instagramUrl: "https://instagram.com/mdaccula",
    youtubeUrl: "https://youtube.com/@mdaccula",
    tiktokUrl: "https://tiktok.com/@mdaccula",
    unsubscribeUrl: "[E-GOI_UNSUBSCRIBE_LINK]",
  };
}

export async function dispatchEventDraftEmail(
  eventId: string,
  opts: { forceResend?: boolean } = {},
): Promise<DispatchEventDraftResult> {
  // 1. Config + template padrão + settings de marca
  const [cfgRes, tplSettingsRes, evRes] = await Promise.all([
    (supabase.from as any)("egoi_config").select("*").maybeSingle(),
    (supabase.from as any)("email_template_settings").select("*").maybeSingle(),
    supabase
      .from("events")
      .select(
        "id,title,subtitle,slug,date,time,venue,location_city,location_state,image_url,description,ticket_link,vip_link,blog_post_id",
      )
      .eq("id", eventId)
      .maybeSingle(),
  ]);

  const cfg = cfgRes?.data;
  if (!cfg) return { ok: false, skipped: true, reason: "no_egoi_config" };
  if (!cfg.is_enabled) return { ok: false, skipped: true, reason: "agency_disabled" };
  if (!cfg.list_id || !cfg.sender_id) {
    return { ok: false, skipped: true, reason: "list_or_sender_missing" };
  }

  const event = evRes.data as EventRow | null;
  if (!event) return { ok: false, error: "Evento não encontrado" };

  // 2. Template padrão (com fallback para primeiro template disponível)
  let template: Template | null = null;
  if (cfg.default_event_template_id) {
    const { data } = await (supabase.from as any)("email_templates")
      .select("*")
      .eq("id", cfg.default_event_template_id)
      .maybeSingle();
    template = data as Template | null;
  }
  if (!template) {
    const { data } = await (supabase.from as any)("email_templates")
      .select("*")
      .eq("is_default", true)
      .maybeSingle();
    template = data as Template | null;
  }

  const settings = (tplSettingsRes?.data ?? {}) as EmailTemplateSettings;

  // 3. Dados do evento + resumo da matéria (se houver)
  const eventData = await buildEventData(event);
  let article: { title: string; excerpt: string; url: string; image_url?: string } | null = null;
  if (event.blog_post_id) {
    const { data: post } = await supabase
      .from("blog_posts")
      .select("title,excerpt,slug,image_url")
      .eq("id", event.blog_post_id)
      .maybeSingle();
    if (post) {
      article = {
        title: post.title,
        excerpt: post.excerpt || "",
        url: `${BASE_URL}/blog/${post.slug}`,
        image_url: post.image_url || undefined,
      };
    }
  }

  // 4. Render HTML
  const html =
    template && Array.isArray(template.blocks) && template.blocks.length > 0
      ? renderBlockedTemplate(template.blocks as Block[], eventData, settings, article)
      : renderEventAnnouncementEmail(eventData, settings);

  const subject =
    (template as any)?.subject ||
    `Novo evento: ${event.title}`;
  const preheader =
    (template as any)?.preheader ||
    `${event.title} — ${eventData.dateLabel} em ${event.venue}, ${event.location_city}-${event.location_state}`;

  // 5. Chama edge function
  const { data, error } = await supabase.functions.invoke(
    "create-event-email-campaign",
    {
      body: {
        event_id: eventId,
        html,
        subject,
        preheader,
        force_resend: opts.forceResend === true,
      },
    },
  );

  if (error) {
    return { ok: false, error: error.message };
  }
  return (data as DispatchEventDraftResult) ?? { ok: false, error: "Resposta vazia" };
}
