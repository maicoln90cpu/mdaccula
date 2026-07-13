/**
 * Sistema de blocos para templates de e-mail.
 *
 * Etapa 2.4 (Fase B): este arquivo agora é um **reexport fino** do renderer
 * canônico em `supabase/functions/_shared/emailBlocks.ts`. Toda a lógica de
 * renderização (HTML e texto) vive lá — frontend (admin/preview) e Edge
 * (envio real) compartilham o mesmo código, garantindo paridade 1:1.
 *
 * Este arquivo mantém apenas o que é usado exclusivamente pelo admin:
 *   - `Template` (formato salvo no banco)
 *   - `newBlockId`, `BLOCK_LABELS`, `AVAILABLE_BLOCKS` (editor)
 *   - `PresetKey`, `buildPresetBlocks`, `TEMPLATE_PRESETS` (galeria de presets)
 */

// ============================================
// Reexport da fonte da verdade (renderer canônico do Edge)
// ============================================
export type {
  SocialNetwork,
  Align,
  Block,
  GlobalBlock,
  ArticleSummary,
  RenderContext,
} from "@shared/emailBlocks.ts";

export {
  expandGlobalRefs,
  proxyForEmail,
  renderBlockedTemplate,
  computePreheader,
} from "@shared/emailBlocks.ts";

import type { Block, SocialNetwork } from "@shared/emailBlocks.ts";

// ============================================
// Tipos exclusivos do admin
// ============================================

export type Template = {
  id?: string;
  name: string;
  type: "event_new" | "ticket_batch" | "weekly_digest" | "weekly_digest_editorial" | "weekend_agenda" | "courtesy" | "custom" | "blog_digest";
  blocks: Block[];
  is_default?: boolean;
  subject_template?: string | null;
  preheader_template?: string | null;
};

// ============================================
// IDs / rótulos / lista disponível (editor)
// ============================================

let blockCounter = Date.now();
export const newBlockId = () => `b${++blockCounter}`;

export const BLOCK_LABELS: Record<Block["kind"], string> = {
  header: "Cabeçalho (logo)",
  hero_image: "Flyer do evento",
  eyebrow: "Etiqueta (texto pequeno)",
  title: "Título do evento",
  subtitle: "Subtítulo do evento",
  event_meta: "Data, hora e local",
  description: "Descrição do evento",
  article_summary: "Resumo da matéria (se houver)",
  lineup: "Line-up do evento",
  countdown: "Contagem regressiva",
  ticker: "Ticker de urgência (barra)",
  static_map: "Mapa estático do local",
  cta_button: "Botão CTA (ingresso)",
  secondary_link: "Link secundário",
  image_with_link: "Imagem com link",
  divider: "Divisor",
  text: "Bloco de texto livre",
  social_icons: "Redes sociais",
  weekend_grid: "Agenda do fim de semana",
  weekly_hero: "Destaque da semana (hero)",
  blog_posts_list: "Últimos posts do blog",
  dedge_block: "Bloco Dedge (residência)",
  global_ref: "Bloco global (biblioteca)",
  footer: "Rodapé + descadastrar",
};

export const AVAILABLE_BLOCKS: Block["kind"][] = [
  "header", "hero_image", "eyebrow", "title", "subtitle", "event_meta",
  "description", "lineup", "article_summary", "countdown", "ticker", "static_map",
  "weekend_grid", "weekly_hero", "blog_posts_list", "dedge_block",
  "cta_button", "secondary_link", "image_with_link", "divider", "text",
  "social_icons", "footer",
];

// ============================================
// Presets de template
// ============================================

export type PresetKey =
  | "event_new"
  | "ticket_batch"
  | "weekly_digest"
  | "weekly_digest_poster"
  | "weekly_digest_editorial"
  | "weekend_agenda_cartaz"
  | "weekend_agenda_timeline"
  | "blog_digest_cards"
  | "blog_digest_editorial"
  | "courtesy";

export function buildPresetBlocks(type: PresetKey): Block[] {
  const defaultSocials: SocialNetwork[] = [
    { id: "instagram", label: "Instagram", url: "https://instagram.com/mdaccula", enabled: true },
    { id: "youtube", label: "YouTube", url: "https://youtube.com/@mdaccula", enabled: true },
    { id: "tiktok", label: "TikTok", url: "https://tiktok.com/@mdaccula", enabled: false },
    { id: "soundcloud", label: "SoundCloud", url: "", enabled: false },
    { id: "spotify", label: "Spotify", url: "", enabled: false },
    { id: "linktree", label: "Linktree", url: "", enabled: false },
  ];

  if (type === "event_new") {
    return [
      { id: newBlockId(), kind: "header", logo_height: 64 },
      { id: newBlockId(), kind: "hero_image" },
      { id: newBlockId(), kind: "eyebrow", text: "Novo evento confirmado" },
      { id: newBlockId(), kind: "title" },
      { id: newBlockId(), kind: "subtitle" },
      { id: newBlockId(), kind: "event_meta" },
      { id: newBlockId(), kind: "description" },
      { id: newBlockId(), kind: "lineup", title: "Line-up", layout: "chips", align: "center" },
      { id: newBlockId(), kind: "article_summary" },
      { id: newBlockId(), kind: "cta_button", label: "Garantir ingresso", url_field: "ticket_link" },
      { id: newBlockId(), kind: "secondary_link", label: "Ver agenda completa", url_field: "agenda_url" },
      { id: newBlockId(), kind: "social_icons", networks: defaultSocials },
      { id: newBlockId(), kind: "footer", include_unsubscribe: true },
    ];
  }

  if (type === "ticket_batch") {
    return [
      { id: newBlockId(), kind: "header", logo_height: 56 },
      {
        id: newBlockId(),
        kind: "image_with_link",
        image_url: "",
        link_url: "",
        alt: "Arte da virada de lote (opcional — preencha na hora do disparo)",
        max_width: 552,
      },
      { id: newBlockId(), kind: "hero_image" },
      { id: newBlockId(), kind: "eyebrow", text: "ÚLTIMAS HORAS · LOTE ATUAL" },
      { id: newBlockId(), kind: "title" },
      { id: newBlockId(), kind: "event_meta" },
      {
        id: newBlockId(),
        kind: "countdown",
        label: "Lote atual encerra em",
        deadline_source: "today_2359",
        bg_style: "gradient",
        align: "center",
      },
      {
        id: newBlockId(),
        kind: "text",
        html: "<p><strong>O lote atual está acabando.</strong> Garanta o seu antes da próxima virada de preço.</p>",
      },
      { id: newBlockId(), kind: "cta_button", label: "Garantir ingresso agora", url_field: "ticket_link" },
      { id: newBlockId(), kind: "divider" },
      { id: newBlockId(), kind: "social_icons", networks: defaultSocials },
      { id: newBlockId(), kind: "footer", include_unsubscribe: true },
    ];
  }

  if (type === "weekly_digest") {
    return [
      { id: newBlockId(), kind: "header", logo_height: 64 },
      { id: newBlockId(), kind: "eyebrow", text: "Resumo da semana · MDAccula" },
      {
        id: newBlockId(),
        kind: "text",
        html:
          "<h2 style=\"color:#fff;font-size:22px;margin:0 0 12px 0;\">O que rolou (e o que vem por aí)</h2>" +
          "<p>Uma seleção rápida dos eventos, matérias e novidades da semana em São Paulo.</p>",
      },
      { id: newBlockId(), kind: "divider" },
      { id: newBlockId(), kind: "weekend_grid", layout: "timeline", show_article_link: true },
      { id: newBlockId(), kind: "divider" },
      { id: newBlockId(), kind: "blog_posts_list", max_items: 3, layout: "list", show_excerpt: true, show_category: true },
      {
        id: newBlockId(), kind: "cta_button",
        label: "Ver tudo no site", url_field: "custom", custom_url: "https://mdaccula.com",
      },
      { id: newBlockId(), kind: "social_icons", networks: defaultSocials },
      { id: newBlockId(), kind: "footer", include_unsubscribe: true },
    ];
  }

  if (type === "weekly_digest_poster") {
    return [
      { id: newBlockId(), kind: "header", logo_height: 60 },
      { id: newBlockId(), kind: "eyebrow", text: "MDACCULA · ESTA SEMANA", align: "center" },
      {
        id: newBlockId(),
        kind: "text",
        html:
          "<h1 style=\"color:#fff;font-size:30px;font-weight:900;margin:6px 0 4px 0;letter-spacing:-0.02em;text-align:center;\">O cartaz da semana</h1>" +
          "<p style=\"color:#a1a1aa;font-size:14px;margin:0 0 4px 0;text-align:center;\">O que não pode faltar na sua agenda — de segunda a domingo em São Paulo.</p>",
        align: "center",
      },
      {
        id: newBlockId(),
        kind: "weekly_hero",
        source: "first_weekend",
        eyebrow: "DESTAQUE DA SEMANA",
        cta_label: "Garantir ingresso",
        show_venue: true,
        show_cta: true,
        overlay_intensity: "strong",
        align: "left",
      },
      { id: newBlockId(), kind: "divider" },
      {
        id: newBlockId(),
        kind: "weekend_grid",
        layout: "cartaz",
        eyebrow: "TAMBÉM ACONTECE",
        title: "Mais programação",
        show_article_link: true,
      },
      { id: newBlockId(), kind: "divider" },
      {
        id: newBlockId(),
        kind: "blog_posts_list",
        title: "Do blog nesta semana",
        eyebrow: "MATÉRIAS",
        max_items: 3,
        layout: "list",
        show_excerpt: true,
        show_category: true,
      },
      { id: newBlockId(), kind: "divider" },
      { id: newBlockId(), kind: "dedge_block", button_style: "dark" },
      { id: newBlockId(), kind: "secondary_link", label: "Ver agenda completa", url_field: "agenda_url" },
      { id: newBlockId(), kind: "social_icons", networks: defaultSocials },
      { id: newBlockId(), kind: "footer", include_unsubscribe: true },
    ];
  }

  if (type === "weekly_digest_editorial") {
    return [
      { id: newBlockId(), kind: "header", logo_height: 52, align: "left" },
      { id: newBlockId(), kind: "eyebrow", text: "EDITORIAL · SEMANA EM SÃO PAULO", align: "left" },
      {
        id: newBlockId(),
        kind: "text",
        html:
          "<h1 style=\"color:#fff;font-size:34px;font-weight:900;margin:6px 0 8px 0;letter-spacing:-0.02em;line-height:1.1;\">A semana começa aqui.</h1>" +
          "<p style=\"color:#a1a1aa;font-size:15px;line-height:1.6;margin:0;\">Uma curadoria enxuta da cena eletrônica — os shows, as festas e as histórias que valem seu tempo entre segunda e domingo.</p>",
        align: "left",
      },
      { id: newBlockId(), kind: "divider" },
      { id: newBlockId(), kind: "eyebrow", text: "AGENDA DA SEMANA", align: "left" },
      {
        id: newBlockId(),
        kind: "weekend_grid",
        layout: "timeline",
        title: "",
        eyebrow: "",
        show_article_link: true,
      },
      { id: newBlockId(), kind: "divider" },
      {
        id: newBlockId(),
        kind: "blog_posts_list",
        title: "Leituras da semana",
        eyebrow: "MATÉRIAS EM ALTA",
        max_items: 3,
        layout: "list",
        show_excerpt: true,
        show_category: true,
        align: "left",
      },
      { id: newBlockId(), kind: "divider" },
      {
        id: newBlockId(),
        kind: "cta_button",
        label: "Ver agenda completa",
        url_field: "custom",
        custom_url: "https://mdaccula.com/eventos",
        full_width: false,
        align: "center",
      },
      { id: newBlockId(), kind: "social_icons", networks: defaultSocials, align: "center" },
      { id: newBlockId(), kind: "footer", include_unsubscribe: true, align: "center" },
    ];
  }

  if (type === "weekend_agenda_cartaz") {
    return [
      { id: newBlockId(), kind: "header", logo_height: 60 },
      { id: newBlockId(), kind: "eyebrow", text: "AGENDA · FIM DE SEMANA", align: "center" },
      {
        id: newBlockId(),
        kind: "text",
        html: "<h1 style=\"color:#fff;font-size:28px;font-weight:900;margin:6px 0 4px 0;letter-spacing:-0.01em;text-align:center;\">O que rola no fds</h1><p style=\"color:#a1a1aa;font-size:14px;margin:0 0 4px 0;text-align:center;\">Sexta, sábado e domingo — os destaques da cena eletrônica em São Paulo.</p>",
        align: "center",
      },
      { id: newBlockId(), kind: "weekend_grid", layout: "cartaz", eyebrow: "", title: "", show_article_link: true },
      { id: newBlockId(), kind: "divider" },
      { id: newBlockId(), kind: "dedge_block", button_style: "dark" },
      { id: newBlockId(), kind: "secondary_link", label: "Ver agenda completa", url_field: "agenda_url" },
      { id: newBlockId(), kind: "social_icons", networks: defaultSocials },
      { id: newBlockId(), kind: "footer", include_unsubscribe: true },
    ];
  }

  if (type === "weekend_agenda_timeline") {
    return [
      { id: newBlockId(), kind: "header", logo_height: 60 },
      { id: newBlockId(), kind: "eyebrow", text: "PROGRAMAÇÃO DO FDS", align: "left" },
      {
        id: newBlockId(),
        kind: "text",
        html: "<h1 style=\"color:#fff;font-size:26px;font-weight:900;margin:6px 0 4px 0;letter-spacing:-0.01em;\">Sexta, sábado e domingo</h1><p style=\"color:#a1a1aa;font-size:14px;margin:0;\">A ordem cronológica da cena eletrônica — do fim de semana em São Paulo.</p>",
        align: "left",
      },
      { id: newBlockId(), kind: "weekend_grid", layout: "timeline", title: "", eyebrow: "", show_article_link: true },
      { id: newBlockId(), kind: "divider" },
      { id: newBlockId(), kind: "dedge_block", button_style: "primary" },
      { id: newBlockId(), kind: "secondary_link", label: "Ver agenda completa", url_field: "agenda_url" },
      { id: newBlockId(), kind: "social_icons", networks: defaultSocials },
      { id: newBlockId(), kind: "footer", include_unsubscribe: true },
    ];
  }

  if (type === "blog_digest_cards") {
    return [
      { id: newBlockId(), kind: "header", logo_height: 60 },
      { id: newBlockId(), kind: "eyebrow", text: "NOVIDADES DO BLOG", align: "center" },
      {
        id: newBlockId(), kind: "text",
        html:
          "<h1 style=\"color:#fff;font-size:30px;font-weight:900;margin:6px 0 4px 0;letter-spacing:-0.02em;text-align:center;\">O que rolou no blog</h1>" +
          "<p style=\"color:#a1a1aa;font-size:14px;margin:0;text-align:center;\">Uma seleção das matérias da semana em São Paulo.</p>",
        align: "center",
      },
      { id: newBlockId(), kind: "divider" },
      {
        id: newBlockId(), kind: "blog_posts_list",
        title: "Matérias em destaque", eyebrow: "DA SEMANA",
        max_items: 10, layout: "list", show_excerpt: true, show_category: true,
      },
      { id: newBlockId(), kind: "divider" },
      {
        id: newBlockId(), kind: "cta_button",
        label: "Ver todas as matérias",
        url_field: "custom", custom_url: "https://mdaccula.com/blog",
        align: "center",
      },
      { id: newBlockId(), kind: "social_icons", networks: defaultSocials },
      { id: newBlockId(), kind: "footer", include_unsubscribe: true },
    ];
  }

  if (type === "blog_digest_editorial") {
    return [
      { id: newBlockId(), kind: "header", logo_height: 52, align: "left" },
      { id: newBlockId(), kind: "eyebrow", text: "EDITORIAL · BLOG MDACCULA", align: "left" },
      {
        id: newBlockId(), kind: "text",
        html:
          "<h1 style=\"color:#fff;font-size:34px;font-weight:900;margin:6px 0 8px 0;letter-spacing:-0.02em;line-height:1.1;\">Leituras da semana.</h1>" +
          "<p style=\"color:#a1a1aa;font-size:15px;line-height:1.6;margin:0;\">Curadoria enxuta das matérias que valem seu tempo.</p>",
        align: "left",
      },
      { id: newBlockId(), kind: "divider" },
      {
        id: newBlockId(), kind: "blog_posts_list",
        title: "", eyebrow: "MATÉRIAS EM ALTA",
        max_items: 8, layout: "list", show_excerpt: true, show_category: true, align: "left",
      },
      { id: newBlockId(), kind: "divider" },
      {
        id: newBlockId(), kind: "cta_button",
        label: "Ler todas no blog",
        url_field: "custom", custom_url: "https://mdaccula.com/blog",
        align: "center",
      },
      { id: newBlockId(), kind: "social_icons", networks: defaultSocials, align: "center" },
      { id: newBlockId(), kind: "footer", include_unsubscribe: true, align: "center" },
    ];
  }

  if (type === "courtesy") {
    return [
      { id: newBlockId(), kind: "header", logo_height: 60, align: "center" },
      { id: newBlockId(), kind: "hero_image", max_width: 552, border_radius: 12 },
      { id: newBlockId(), kind: "eyebrow", text: "CORTESIA · VAGAS LIMITADAS", align: "left", text_color: "#f59e0b" },
      { id: newBlockId(), kind: "title", align: "left", font_size: 30 },
      { id: newBlockId(), kind: "subtitle", align: "left" },
      { id: newBlockId(), kind: "event_meta", layout: "columns" },
      {
        id: newBlockId(),
        kind: "text",
        html:
          "<p style=\"font-size:15px;line-height:1.55;margin:0 0 10px 0;\">" +
          "<strong>Boas notícias:</strong> liberamos algumas cortesias para esse rolê." +
          "</p>" +
          "<p style=\"font-size:15px;line-height:1.55;margin:0;\">" +
          "São <strong>poucas vagas</strong> e vão por ordem de chegada — quem confirmar primeiro garante. " +
          "Corre antes que acabe." +
          "</p>",
        align: "left",
      },
      { id: newBlockId(), kind: "description", align: "left" },
      { id: newBlockId(), kind: "static_map", zoom: 15, height: 260, map_style: "roadmap", show_address_label: true, border_radius: 12 },
      {
        id: newBlockId(),
        kind: "cta_button",
        label: "Quero minha cortesia",
        url_field: "ticket_link",
        align: "center",
        full_width: true,
        bg_style: "gradient",
      },
      {
        id: newBlockId(),
        kind: "text",
        html:
          "<p style=\"font-size:12px;color:#a1a1aa;line-height:1.5;margin:0;text-align:center;\">" +
          "Cortesias sujeitas à disponibilidade. Chegue cedo — a fila anda rápido." +
          "</p>",
        align: "center",
      },
      { id: newBlockId(), kind: "divider" },
      { id: newBlockId(), kind: "social_icons", networks: defaultSocials },
      { id: newBlockId(), kind: "footer", include_unsubscribe: true },
    ];
  }

  return [];
}

export const TEMPLATE_PRESETS: Array<{
  key: PresetKey;
  name: string;
  description: string;
  subject_template: string;
  preheader_template: string;
  template_type: "event_new" | "ticket_batch" | "weekly_digest" | "weekend_agenda" | "courtesy" | "custom" | "blog_digest";
}> = [
  {
    key: "event_new",
    name: "Novo evento",
    description: "Anúncio de evento novo confirmado — flyer, data, local, CTA de ingresso e resumo da matéria (se houver).",
    subject_template: "🎧 Novo evento: {{event_title}} — {{date_label}}",
    preheader_template: "{{event_title}} em {{venue_name}}, {{city_state}}. Ingressos abertos.",
    template_type: "event_new",
  },
  {
    key: "ticket_batch",
    name: "Virada de lote",
    description: "Aviso de urgência para virada de lote (mesmo dia ou 1 dia antes). Inclui bloco de arte específica opcional.",
    subject_template: "⏰ Últimas horas do lote — {{event_title}}",
    preheader_template: "O lote atual está acabando. Garanta antes da próxima virada de preço.",
    template_type: "ticket_batch",
  },
  {
    key: "weekly_digest",
    name: "Resumo semanal",
    description: "Newsletter semanal com destaques da agenda e matérias do blog.",
    subject_template: "📬 MDAccula desta semana",
    preheader_template: "Eventos, matérias e novidades da cena eletrônica em São Paulo.",
    template_type: "weekly_digest",
  },
  {
    key: "weekly_digest_poster",
    name: "Digest semanal — Cartaz da semana ⭐",
    description: "Recomendado. Hero de destaque + grade cartaz com toda a semana + últimos posts do blog + bloco Dedge. Ideal para o disparo de segunda-feira.",
    subject_template: "🎧 O cartaz da semana — {{week_range}}",
    preheader_template: "Destaque da semana, agenda completa e as matérias mais quentes da cena.",
    template_type: "weekly_digest",
  },
  {
    key: "weekly_digest_editorial",
    name: "Digest semanal — Editorial",
    description: "Estilo revista, minimalista. Título grande, timeline da semana e matérias em destaque. Sem bloco Dedge por padrão — foco editorial.",
    subject_template: "📖 A semana em São Paulo — {{week_range}}",
    preheader_template: "Curadoria enxuta: shows, festas e as histórias que valem seu tempo.",
    template_type: "weekly_digest",
  },
  {
    key: "weekend_agenda_cartaz",
    name: "Agenda do FDS — Cartaz digital ⭐",
    description: "Recomendado. Cards full-width com flyers grandes, badge do dia e bloco Dedge de encerramento em preto/branco.",
    subject_template: "🎧 Seu fds em São Paulo — {{weekend_range}}",
    preheader_template: "Sexta, sábado e domingo — os destaques da cena eletrônica.",
    template_type: "weekend_agenda",
  },
  {
    key: "weekend_agenda_timeline",
    name: "Agenda do FDS — Timeline por dia",
    description: "Layout compacto com barra colorida por dia e miniaturas. Bloco Dedge com botões coloridos ao final.",
    subject_template: "📅 Programação do fds — {{weekend_range}}",
    preheader_template: "Do sunset de sexta ao after de domingo. Sua semana começa aqui.",
    template_type: "weekend_agenda",
  },
  {
    key: "blog_digest_cards",
    name: "Blog news — Cards ⭐",
    description: "Novidades do blog em formato de cards. Ideal para o disparo dominical com as matérias da semana.",
    subject_template: "📰 Novidades do blog — {{range_label}}",
    preheader_template: "As matérias mais lidas da semana no MDAccula.",
    template_type: "blog_digest",
  },
  {
    key: "blog_digest_editorial",
    name: "Blog news — Editorial",
    description: "Novidades do blog em formato editorial (estilo revista). Só posts, sem eventos.",
    subject_template: "📖 Leituras da semana — {{range_label}}",
    preheader_template: "Uma curadoria editorial das matérias mais lidas em São Paulo.",
    template_type: "blog_digest",
  },
  {
    key: "courtesy",
    name: "Cortesia — oportunidade (genérico)",
    description: "Convite genérico de cortesia com gatilho de escassez: mesma estrutura do 'Novo evento', mas com copy destacando que as vagas são limitadas e por ordem de chegada. Não personaliza por convidado — envio único para toda a lista.",
    subject_template: "🎟️ Cortesia liberada — {{event_title}} (poucas vagas)",
    preheader_template: "Cortesias limitadas para {{event_title}}. Garanta a sua antes que acabe.",
    template_type: "courtesy",
  },
];
