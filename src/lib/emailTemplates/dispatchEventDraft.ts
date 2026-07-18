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
  type Template,
  type Block,
  type GlobalBlock,
} from "./blocks";
import {
  buildEventAnnouncementData,
  applyEmailBlockOverrides,
  composeEmail,
  type EmailCompositionIssue,
  type EmailEventRow,
} from "./emailComposer";
import {
  type EmailTemplateSettings,
} from "./eventAnnouncement";

export type DispatchEventDraftResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  status?: string;
  egoi_campaign_id?: string | null;
  error?: string | null;
  validation_issues?: EmailCompositionIssue[];
  scheduled_at?: string | null;
};

type EventRow = EmailEventRow & {
  blog_post_id?: string | null;
};

const BASE_URL = "https://mdaccula.com";

async function buildEventData(event: EventRow) {
  return buildEventAnnouncementData(event, { baseUrl: BASE_URL });
}

export async function dispatchEventDraftEmail(
  eventId: string,
  opts: {
    forceResend?: boolean;
    sendNow?: boolean;
    /** Agenda o disparo para uma data/hora futura (ISO) em vez de enviar agora. */
    scheduleAt?: string;
    /** B.8 — força usar um template específico (ex.: ticket_batch). */
    templateIdOverride?: string;
    /** B.8 — substitui a arte principal (flyer) por uma imagem específica do disparo. */
    flyerOverrideUrl?: string;
    /** B.8 — sobrescreve o assunto do e-mail (ex.: "ÚLTIMAS HORAS — {evento}"). */
    subjectOverride?: string;
    /** Snapshot já exibido ao admin. Evita remontar HTML entre preview e clique. */
    preparedComposition?: { html: string; subject: string; preheader: string };
    /** B.10 — marca este disparo como uma variante de teste A/B. */
    abTest?: {
      groupId: string;
      variant: "A" | "B";
      config: {
        subject_a: string;
        subject_b: string;
        winner_metric: "opens" | "clicks";
      };
    };
  } = {},
): Promise<DispatchEventDraftResult> {
  if (opts.preparedComposition && !opts.templateIdOverride) {
    return { ok: false, error: "Envio manual exige um template selecionado" };
  }
  if (opts.scheduleAt && opts.sendNow) {
    return { ok: false, error: "Agendar e enviar agora são mutuamente exclusivos" };
  }
  // 1. Config + template padrão + settings de marca
  const [cfgRes, tplSettingsRes, evRes] = await Promise.all([
    (supabase.from as any)("egoi_config").select("*").maybeSingle(),
    (supabase.from as any)("email_template_settings").select("*").maybeSingle(),
    supabase
      .from("events")
      .select(
        "id,title,subtitle,slug,date,time,venue,location_city,location_state,image_url,description,ticket_link,vip_link,cta_type,blog_post_id,lineup,latitude,longitude,venue_lat,venue_lng",
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

  // O bloco de mapa do e-mail depende de latitude/longitude, que hoje só é
  // preenchido reativamente quando alguém visita /eventos/:slug (EventLocationMap) —
  // o disparo de e-mail costuma acontecer antes disso. Geocodifica aqui, sob
  // demanda, para o mapa já sair correto no primeiro envio (silenciosamente
  // vazio por design se a geocodificação falhar — ver emailBlocks.ts).
  if (event.latitude == null || event.longitude == null) {
    const { data: geo } = await supabase.functions.invoke("geocode-event", {
      body: { event_id: eventId },
    });
    if (geo?.ok && geo.lat != null && geo.lng != null) {
      event.latitude = geo.lat;
      event.longitude = geo.lng;
    }
  }

  // 2. Template — override tem prioridade; senão template padrão de evento por tipo.
  let template: Template | null = null;
  if (opts.templateIdOverride) {
    const { data } = await (supabase.from as any)("email_templates")
      .select("*")
      .eq("id", opts.templateIdOverride)
      .maybeSingle();
    template = data as Template | null;
  }
  if (!template && cfg.default_event_template_id) {
    const { data } = await (supabase.from as any)("email_templates")
      .select("*")
      .eq("id", cfg.default_event_template_id)
      .maybeSingle();
    template = (data as Template | null)?.type === "event_new" ? (data as Template) : null;
  }
  if (!template) {
    const { data } = await (supabase.from as any)("email_templates")
      .select("*")
      .eq("type", "event_new")
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    template = data as Template | null;
  }
  if (!template) {
    return { ok: false, error: "Nenhum template do tipo Evento encontrado" };
  }

  const settings = (tplSettingsRes?.data ?? {}) as EmailTemplateSettings;

  // 3. Dados do evento + resumo da matéria (se houver)
  if (opts.flyerOverrideUrl) event.image_url = opts.flyerOverrideUrl;
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

  // B.8 — se veio arte específica, preenche blocos image_with_link vazios
  // (útil no preset "ticket_batch" que já tem esse bloco pronto).
  const resolvedBlocks: Block[] | null = template && Array.isArray(template.blocks)
    ? applyEmailBlockOverrides(template.blocks as Block[], {
        artworkUrl: opts.flyerOverrideUrl || eventData.flyerUrl,
        defaultLink: eventData.ticketUrl,
      })
    : null;

  // 4. Carrega blocos globais (Fase C) e expande refs antes do render
  let globalsMap: Map<string, GlobalBlock> | undefined;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await (supabase.from as any)("email_global_blocks")
      .select("id, name, description, category, block");
    if (data && Array.isArray(data)) {
      globalsMap = new Map(data.map((g: any) => [g.id, g as GlobalBlock]));
    }
  } catch {
    // segue sem globals; global_refs serão renderizados como placeholder
  }

  const composition = composeEmail({
    template: {
      blocks: resolvedBlocks ?? [],
      subject_template: opts.subjectOverride || template.subject_template,
      preheader_template: template.preheader_template,
    },
    event: eventData,
    settings,
    article,
    globals: globalsMap,
  });
  if (composition.issues.length > 0) {
    return {
      ok: false,
      error: composition.issues.map((item) => item.message).join(" "),
      validation_issues: composition.issues,
    };
  }
  const finalComposition = opts.preparedComposition ?? composition;

  // 5. Chama edge function
  const invokeBody: Record<string, unknown> = {
    event_id: eventId,
    html: finalComposition.html,
    subject: finalComposition.subject,
    preheader: finalComposition.preheader,
    template_type: template.type,
    force_resend: opts.forceResend === true,
    send_now: opts.sendNow === true,
  };
  if (opts.scheduleAt) {
    invokeBody.schedule_at = opts.scheduleAt;
  }
  if (opts.abTest) {
    invokeBody.ab_group_id = opts.abTest.groupId;
    invokeBody.ab_variant = opts.abTest.variant;
    invokeBody.ab_test_config = opts.abTest.config;
  }

  const { data, error } = await supabase.functions.invoke(
    "create-event-email-campaign",
    { body: invokeBody },
  );

  if (error) {
    return { ok: false, error: error.message };
  }
  return (data as DispatchEventDraftResult) ?? { ok: false, error: "Resposta vazia" };
}

/**
 * B.10 — Dispara teste A/B de assunto criando 2 campanhas na E-goi (variantes A e B),
 * cada uma com um assunto distinto, ambas apontando para a lista completa.
 * O vencedor é apurado depois pelas métricas B.9 (open_rate ou click_rate).
 *
 * Nota: a v3 REST da E-goi não expõe endpoint nativo de split-test por assunto.
 * Este é o fallback documentado no plano — duas campanhas independentes.
 */
export async function dispatchAbSubjectTest(
  eventId: string,
  params: {
    subjectA: string;
    subjectB: string;
    winnerMetric: "opens" | "clicks";
    sendNow: boolean;
    templateIdOverride?: string;
  },
): Promise<{ variantA: DispatchEventDraftResult; variantB: DispatchEventDraftResult; groupId: string }> {
  const groupId =
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `ab-${Date.now()}-${Math.random().toString(16).slice(2)}`) as string;

  const config = {
    subject_a: params.subjectA,
    subject_b: params.subjectB,
    winner_metric: params.winnerMetric,
  };

  const variantA = await dispatchEventDraftEmail(eventId, {
    sendNow: params.sendNow,
    templateIdOverride: params.templateIdOverride,
    subjectOverride: params.subjectA,
    abTest: { groupId, variant: "A", config },
  });

  const variantB = await dispatchEventDraftEmail(eventId, {
    sendNow: params.sendNow,
    templateIdOverride: params.templateIdOverride,
    subjectOverride: params.subjectB,
    abTest: { groupId, variant: "B", config },
  });

  return { variantA, variantB, groupId };
}

