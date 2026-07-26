// Monta o payload EventAnnouncementData para o renderer de blocos do
// weekly-digest-draft. Extraído do index.ts na Onda 29 sem alterar o HTML
// gerado. Regras preservadas 1:1:
//   - templates "Cartaz" e residências DEDGE agrupam datas em UM card.
//   - DEDGE nunca aparece no weekend_grid; só via bloco dedge_block.
import type {
  BlogPostItem,
  EventAnnouncementData,
  WeekendEventItem,
} from "../emailBlocks.ts";
import { DEFAULT_EVENT_CTA_TYPE, getEventCtaButtonLabel } from "../eventCta.ts";
import type { BrandSettings, EventRow, PostRow } from "./legacyHtml.ts";
import { formatDatePt } from "./legacyHtml.ts";

const SITE_URL = "https://mdaccula.com";

type MergedEventRow = EventRow & {
  __joinedDates?: string;
  __isDedge?: boolean;
  __subEvents?: Array<{ label: string; url: string; dayLabel: string; timeLabel: string }>;
};

const isDedgeVenue = (v: string) => /d\.?\s*edge/i.test((v || "").trim());

export function buildEventPayload(
  evs: EventRow[],
  pts: PostRow[],
  settings: BrandSettings,
  activeTpl: { name?: string } | null,
  rangeLabel: string,
  digestLabel: string,
): EventAnnouncementData {
  const tplName = String(activeTpl?.name || "").toLowerCase();
  const isCartazTemplate = tplName.includes("cartaz");

  const groupsMap = evs.reduce<Record<string, EventRow[]>>((acc, e) => {
    const key = (e.venue || "").trim().toLowerCase() || e.id;
    (acc[key] ||= []).push(e);
    return acc;
  }, {});

  const evsForRender: MergedEventRow[] = Object.values(groupsMap)
    .map((group) => group.sort((a, b) => a.date.localeCompare(b.date)))
    .flatMap((group): MergedEventRow[] => {
      const head = group[0];
      const shouldMerge = group.length > 1 && (isCartazTemplate || isDedgeVenue(head.venue));
      if (!shouldMerge) return group;
      const joinedDates = group.map((g) => formatDatePt(g.date, g.time)).join(" · ");
      const subEvents = group.map((g) => ({
        label: g.title,
        url: g.ticket_link || `${SITE_URL}/eventos/${g.slug}`,
        dayLabel: formatDatePt(g.date, g.time),
        timeLabel: (g.time || "").slice(0, 5) || "22h",
      }));
      return [{
        ...head,
        title: head.venue,
        date: head.date,
        __joinedDates: joinedDates,
        __isDedge: isDedgeVenue(head.venue),
        __subEvents: subEvents,
      }];
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const dedgeGroup = evsForRender.filter((e) => e.__isDedge || isDedgeVenue(e.venue));
  const nonDedge = evsForRender.filter((e) => !(e.__isDedge || isDedgeVenue(e.venue)));
  const first = nonDedge[0] ?? evsForRender[0];

  const weekendEvents: WeekendEventItem[] = nonDedge.map((e) => ({
    id: e.id,
    title: e.title,
    dayLabel: e.__joinedDates
      ? e.__joinedDates
      : (e.end_date && e.end_date !== e.date
          ? `${formatDatePt(e.date, e.time)} → ${formatDatePt(e.end_date, e.time)}`
          : formatDatePt(e.date, e.time)),
    timeLabel: (e.time || "").slice(0, 5) || "22h",
    venue: e.venue,
    cityState: `${e.location_city}-${e.location_state}`,
    imageUrl: e.image_url || `${SITE_URL}/placeholder.svg`,
    eventUrl: `${SITE_URL}/eventos/${e.slug}`,
    ticketUrl: e.ticket_link || `${SITE_URL}/eventos/${e.slug}`,
    ctaLabel: e.cta_type && e.cta_type !== DEFAULT_EVENT_CTA_TYPE ? getEventCtaButtonLabel(e.cta_type) : undefined,
  }));

  const dedgeHead = dedgeGroup[0];
  const dedgeSubs = dedgeHead
    ? (dedgeHead.__subEvents ?? [{
        label: dedgeHead.title,
        url: dedgeHead.ticket_link || `${SITE_URL}/eventos/${dedgeHead.slug}`,
        dayLabel: formatDatePt(dedgeHead.date, dedgeHead.time),
        timeLabel: (dedgeHead.time || "").slice(0, 5) || "22h",
      }])
    : [];
  const dedgePayload = dedgeHead ? {
    imageUrl: dedgeHead.image_url || `${SITE_URL}/placeholder.svg`,
    eyebrow: "TODA SEMANA · RESIDÊNCIA",
    title: "Dedge — sua residência da semana",
    description: "",
    nights: dedgeSubs.map((s) => ({
      label: `${s.dayLabel} — ${s.label}`,
      url: s.url,
      enabled: true,
    })),
    primaryUrl: `${SITE_URL}/eventos?venue=dedge`,
    primaryLabel: "Ver todos os eventos Dedge",
  } : undefined;

  const blogPosts: BlogPostItem[] = pts.map((p) => ({
    id: p.id,
    title: p.title,
    excerpt: p.excerpt ?? undefined,
    imageUrl: p.image_url ?? undefined,
    url: `${SITE_URL}/blog/${p.slug}`,
  }));

  const settingsAny = settings as BrandSettings & {
    instagram_url?: string; youtube_url?: string; tiktok_url?: string;
  };

  return {
    eventTitle: first?.title || (digestLabel.includes("FDS") ? "Agenda do fim de semana" : "O que rola na semana"),
    eventSubtitle: `${digestLabel} · ${rangeLabel}`,
    flyerUrl: first?.image_url || settings.logo_url || `${SITE_URL}/placeholder.svg`,
    dateLabel: rangeLabel,
    timeLabel: first ? ((first.time || "").slice(0, 5) || "22h") : "",
    venueName: first?.venue || "São Paulo",
    cityState: first ? `${first.location_city}-${first.location_state}` : "São Paulo-SP",
    description: "Os destaques da agenda e do blog nos próximos dias em São Paulo.",
    ticketUrl: first ? (first.ticket_link || `${SITE_URL}/eventos/${first.slug}`) : `${SITE_URL}/eventos`,
    eventUrl: first ? `${SITE_URL}/eventos/${first.slug}` : `${SITE_URL}/eventos`,
    agendaUrl: `${SITE_URL}/eventos`,
    instagramUrl: settingsAny.instagram_url || "",
    youtubeUrl: settingsAny.youtube_url || "",
    tiktokUrl: settingsAny.tiktok_url || "",
    unsubscribeUrl: "[E-GOI_UNSUBSCRIBE_LINK]",
    weekendEvents,
    blogPosts,
    dedge: dedgePayload,
  };
}
