// Dispatcher enxuto — delega a renderização de cada bloco para módulos por família.
// Extraído de renderBlock.ts (Onda 23) sem alterar HTML gerado. Ordem de tentativa:
// basic → interactive → digest. O primeiro que reconhecer o `kind` responde.
import type { Block, RenderContext } from "./types.ts";
import { computeStyle } from "./renderBlock/style.ts";
import { renderBasicBlock } from "./renderBlock/basic.ts";
import { renderInteractiveBlock } from "./renderBlock/interactive.ts";
import { renderDigestBlock } from "./renderBlock/digest.ts";

export function renderBlock(block: Block, ctx: RenderContext): string {
  // Bloco oculto (toggle do olho no editor): pula render em preview e em envio real.
  // Paridade com src/lib/emailTemplates/blocks.ts (linha do check `hidden`).
  if ((block as { hidden?: boolean }).hidden) return "";

  const style = computeStyle(ctx.settings);

  const basic = renderBasicBlock(block, ctx, style);
  if (basic !== null) return basic;

  const interactive = renderInteractiveBlock(block, ctx, style);
  if (interactive !== null) return interactive;

  const digest = renderDigestBlock(block, ctx, style);
  if (digest !== null) return digest;

  return "";
}
