import { describe, expect, it } from "vitest";
import {
  buildEventAnnouncementData,
  composeEmail,
  type EmailEventRow,
} from "@shared/emailComposer.ts";
import type { Block } from "@shared/emailBlocks.ts";

const row: EmailEventRow = {
  id: "event-1",
  title: "Krush",
  subtitle: "Cortesias limitadas",
  slug: "krush",
  date: "2026-07-17",
  time: "21:00:00",
  venue: "Casa Aragon",
  location_city: "Sao Paulo",
  location_state: "SP",
  image_url: "https://cdn.example.com/krush.jpg",
  description: "Uma noite especial.",
  ticket_link: "https://tickets.example.com/krush",
  vip_link: "https://wa.me/5511999999999",
  cta_type: "courtesy",
  lineup: ["BARJA", "DRE GUAZZELLI"],
  latitude: -23.5,
  longitude: -46.6,
  venue_lat: null,
  venue_lng: null,
};

const article = {
  title: "Guia do evento",
  excerpt: "Tudo que voce precisa saber.",
  url: "https://mdaccula.com/blog/krush",
  image_url: "https://cdn.example.com/article.jpg",
};

const allKinds: Block[] = [
  { id: "header", kind: "header" },
  { id: "hero", kind: "hero_image" },
  { id: "eyebrow", kind: "eyebrow", text: "CORTESIA" },
  { id: "title", kind: "title" },
  { id: "subtitle", kind: "subtitle" },
  { id: "meta", kind: "event_meta" },
  { id: "description", kind: "description" },
  { id: "article", kind: "article_summary" },
  { id: "cta", kind: "cta_button", url_field: "vip_link" },
  { id: "secondary", kind: "secondary_link", url_field: "event_url" },
  { id: "image", kind: "image_with_link", image_url: "https://cdn.example.com/a.jpg", link_url: "https://mdaccula.com" },
  { id: "divider", kind: "divider" },
  { id: "text", kind: "text", html: "<p>Oi</p>" },
  { id: "social", kind: "social_icons", networks: [{ id: "instagram", label: "Instagram", url: "https://instagram.com/mdaccula", enabled: true }] },
  { id: "lineup", kind: "lineup" },
  { id: "countdown", kind: "countdown", deadline_source: "event_start" },
  { id: "ticker", kind: "ticker" },
  { id: "map", kind: "static_map" },
  { id: "weekend", kind: "weekend_grid" },
  { id: "dedge", kind: "dedge_block" },
  { id: "weekly", kind: "weekly_hero" },
  { id: "posts", kind: "blog_posts_list" },
  { id: "footer", kind: "footer" },
];

describe("compositor canonico de e-mail", () => {
  it("converte todos os dados do evento usados pelos blocos", () => {
    const data = buildEventAnnouncementData(row);

    expect(data.lineup).toEqual(["BARJA", "DRE GUAZZELLI"]);
    expect(data.vipLink).toBe(row.vip_link);
    expect(data.eventStartIso).toBe(new Date("2026-07-17T21:00:00").toISOString());
    expect(data.venueLat).toBe(row.latitude);
    expect(data.venueLng).toBe(row.longitude);
  });

  it("deriva ctaLabel do cta_type quando nao-padrao (regressao: botao fixo por URL)", () => {
    const courtesy = buildEventAnnouncementData(row);
    expect(courtesy.ctaLabel).toBe("Emitir Cortesia");

    const defaultType = buildEventAnnouncementData({ ...row, cta_type: "buy_ticket" });
    expect(defaultType.ctaLabel).toBeUndefined();

    const guestList = buildEventAnnouncementData({ ...row, cta_type: "guest_list" });
    expect(guestList.ctaLabel).toBe("Enviar Nomes para Lista");
  });

  it("usa venue_lat/venue_lng quando latitude/longitude ainda nao existem", () => {
    const data = buildEventAnnouncementData({
      ...row,
      latitude: null,
      longitude: null,
      venue_lat: -23.55,
      venue_lng: -46.65,
    });

    expect(data.venueLat).toBe(-23.55);
    expect(data.venueLng).toBe(-46.65);
  });

  it("renderiza lineup e link VIP no HTML final", () => {
    const result = composeEmail({
      template: {
        blocks: [
          { id: "lineup", kind: "lineup" },
          { id: "vip", kind: "cta_button", url_field: "vip_link", label: "VIP" },
        ],
        subject_template: "{{event_title}}",
        preheader_template: "{{venue_name}}",
      },
      event: buildEventAnnouncementData(row),
    });

    expect(result.issues).toEqual([]);
    expect(result.html).toContain("BARJA");
    expect(result.html).toContain("DRE GUAZZELLI");
    expect(result.html).toContain("https://wa.me/5511999999999");
  });

  it("valida todos os blocos dependentes de dados e ignora blocos ocultos", () => {
    const event = buildEventAnnouncementData(row);
    event.weekendEvents = [{
      id: "w1", title: "Krush", dayLabel: "sexta", timeLabel: "21h", venue: "Casa Aragon",
      cityState: "Sao Paulo-SP", imageUrl: row.image_url!, eventUrl: event.eventUrl, ticketUrl: event.ticketUrl,
    }];
    event.blogPosts = [{ id: "p1", title: "Post", url: article.url }];
    event.dedge = { imageUrl: "https://cdn.example.com/dedge.jpg", title: "Dedge", description: "Programacao", nights: [{ label: "Sex", url: "https://mdaccula.com", enabled: true }] };

    const valid = composeEmail({
      template: { blocks: allKinds, subject_template: "{{event_title}}" },
      event,
      article,
    });
    expect(valid.issues).toEqual([]);

    const invalid = composeEmail({
      template: {
        blocks: [
          { id: "lu", kind: "lineup" },
          { id: "map", kind: "static_map" },
          { id: "article", kind: "article_summary" },
          { id: "hidden", kind: "description", hidden: true } as Block,
        ],
        subject_template: "Assunto",
      },
      event: { ...event, lineup: [], venueLat: undefined, venueLng: undefined, description: "" },
      article: null,
    });

    expect(invalid.issues.map((issue) => issue.blockId)).toEqual(["lu", "map", "article"]);
  });
});
