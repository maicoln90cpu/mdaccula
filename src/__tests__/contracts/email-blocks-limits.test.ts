/**
 * Fase B2 — Fonte única de limites dos blocos de e-mail.
 *
 * Após unificação, `supabase/functions/_shared/emailBlocksLimits.ts` é a única
 * fonte de verdade, importada tanto pelo frontend quanto pelas edge functions.
 * Este teste garante que os limites permaneçam consistentes/válidos.
 */
import { describe, it, expect } from "vitest";
import { EMAIL_BLOCK_LIMITS } from "@shared/emailBlocksLimits.ts";

describe("Contrato — limites dos blocos de e-mail (fonte única)", () => {
  it("blog_posts_list permite até 10 itens (regressão do bug de 5)", () => {
    expect(EMAIL_BLOCK_LIMITS.blogPostsList.maxItems).toBe(10);
  });

  it("todos os limites têm min ≤ default ≤ max quando aplicável", () => {
    const { logo, padding, image, heading, divider, map, blogPostsList } = EMAIL_BLOCK_LIMITS;
    expect(logo.minHeight).toBeLessThanOrEqual(logo.defaultHeight);
    expect(logo.defaultHeight).toBeLessThanOrEqual(logo.maxHeight);
    expect(padding.minY).toBeLessThanOrEqual(padding.defaultY);
    expect(padding.defaultY).toBeLessThanOrEqual(padding.maxY);
    expect(image.minWidth).toBeLessThanOrEqual(image.defaultWidth);
    expect(image.defaultWidth).toBeLessThanOrEqual(image.maxWidth);
    expect(heading.minFontSize).toBeLessThanOrEqual(heading.defaultFontSize);
    expect(heading.defaultFontSize).toBeLessThanOrEqual(heading.maxFontSize);
    expect(divider.minWidth).toBeLessThanOrEqual(divider.defaultWidth);
    expect(divider.defaultWidth).toBeLessThanOrEqual(divider.maxWidth);
    expect(map.minZoom).toBeLessThanOrEqual(map.defaultZoom);
    expect(map.defaultZoom).toBeLessThanOrEqual(map.maxZoom);
    expect(blogPostsList.minItems).toBeLessThanOrEqual(blogPostsList.defaultItems);
    expect(blogPostsList.defaultItems).toBeLessThanOrEqual(blogPostsList.maxItems);
  });
});
