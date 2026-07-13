/**
 * Fase B1 — Fonte única de limites dos blocos de e-mail.
 *
 * Impede que `src/lib/emailTemplates/blocksLimits.ts` (frontend) e
 * `supabase/functions/_shared/emailBlocksLimits.ts` (edge) divirjam.
 * Esse tipo de divergência causou o bug de 5 posts (frontend) vs 10 posts
 * (edge) no `blog_posts_list`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { EMAIL_BLOCK_LIMITS as FRONT_LIMITS } from "@/lib/emailTemplates/blocksLimits";

const ROOT = process.cwd();
const FRONT_PATH = path.join(ROOT, "src/lib/emailTemplates/blocksLimits.ts");
const EDGE_PATH = path.join(ROOT, "supabase/functions/_shared/emailBlocksLimits.ts");

/** Extrai o bloco `EMAIL_BLOCK_LIMITS = { ... } as const;` do arquivo. */
function extractLimitsBlock(source: string): string {
  const match = source.match(/EMAIL_BLOCK_LIMITS\s*=\s*(\{[\s\S]*?\})\s*as const;/);
  if (!match) throw new Error("EMAIL_BLOCK_LIMITS não encontrado");
  return match[1].replace(/\s+/g, "");
}

describe("Contrato — limites dos blocos de e-mail (frontend ↔ edge)", () => {
  const frontSource = readFileSync(FRONT_PATH, "utf-8");
  const edgeSource = readFileSync(EDGE_PATH, "utf-8");

  it("bloco EMAIL_BLOCK_LIMITS é textualmente idêntico nos dois arquivos", () => {
    expect(extractLimitsBlock(edgeSource)).toBe(extractLimitsBlock(frontSource));
  });

  it("blog_posts_list permite até 10 itens (regressão do bug de 5)", () => {
    expect(FRONT_LIMITS.blogPostsList.maxItems).toBe(10);
  });

  it("todos os limites têm min ≤ default ≤ max quando aplicável", () => {
    const { logo, padding, image, heading, divider, map, blogPostsList } = FRONT_LIMITS;
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
