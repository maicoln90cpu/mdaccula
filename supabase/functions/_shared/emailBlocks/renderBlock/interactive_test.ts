// R-056 — Badges do line-up (layout "chips") coladas sem espaço no Outlook.
// Causa: os <span> de cada artista eram unidos com "" (nenhum separador real),
// contando só com display:inline-block + margin (que o Outlook, engine do
// Word, ignora em e-mail) pra dar espaçamento visual. No Gmail (respeita
// inline-block) ficava certo; no Outlook os nomes colavam uns nos outros
// (bug real reportado: "D-Nox deKolombo beRiascode...").
import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { renderInteractiveBlock } from "./interactive.ts";
import { computeStyle } from "./style.ts";
import type { Block, RenderContext } from "../types.ts";

function baseCtx(lineup: string[]): RenderContext {
  return {
    event: {
      eventTitle: "Evento Teste",
      flyerUrl: "",
      dateLabel: "",
      timeLabel: "",
      venueName: "",
      cityState: "",
      description: "",
      ticketUrl: "",
      eventUrl: "",
      agendaUrl: "",
      instagramUrl: "",
      youtubeUrl: "",
      tiktokUrl: "",
      unsubscribeUrl: "",
      lineup,
    },
    settings: {
      brand_name: "MDAccula",
      primary_color: "#a855f7",
      accent_color: "#2563eb",
      background_color: "#050505",
      footer_text: "",
      cta_label: "Garantir ingresso",
    },
  };
}

Deno.test("lineup layout chips: cada badge fica separada por um espaço real no HTML gerado", () => {
  const block: Block = { id: "b1", kind: "lineup", layout: "chips" };
  const ctx = baseCtx(["D-Nox", "Kolombo", "Riascode", "Dre Guazzelli", "Gui Accula", "N.A.S.S.I"]);
  const html = renderInteractiveBlock(block, ctx, computeStyle(ctx.settings));
  assert(html, "esperava HTML não-nulo pro bloco de lineup");

  // Sem isso, no Outlook os nomes ficam colados: "D-Nox<span>Kolombo..." vira
  // visualmente "D-NoxKolombo" (inline-block/margin ignorados).
  const spanCloseFollowedBySpanOpen = /<\/span>\s+<span/g;
  const matches = [...(html as string).matchAll(spanCloseFollowedBySpanOpen)];
  assert(
    matches.length >= 5,
    `esperava espaço real entre cada uma das 6 badges (5 junções) — achei ${matches.length}. ` +
      "Sem esse espaço, clientes que ignoram inline-block/margin (Outlook) colam os nomes.",
  );

  assertStringIncludes(html as string, "D-Nox");
  assertStringIncludes(html as string, "N.A.S.S.I");
});
