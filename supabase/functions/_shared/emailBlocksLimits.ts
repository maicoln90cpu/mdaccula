/**
 * Fonte ÚNICA de limites/defaults numéricos dos blocos de e-mail.
 *
 * Importado tanto pelas edge functions (Deno) quanto pelo frontend
 * (Vite via alias `@shared/emailBlocksLimits.ts`).
 *
 * NÃO duplicar em `src/`. Fase B2 removeu a versão espelhada.
 */


export const EMAIL_BLOCK_LIMITS = {
  logo: { minHeight: 24, maxHeight: 200, defaultHeight: 64 },
  padding: { minY: 0, maxY: 80, defaultY: 32 },
  image: { minWidth: 300, maxWidth: 600, defaultWidth: 552 },
  heading: { minFontSize: 18, maxFontSize: 48, defaultFontSize: 28 },
  divider: { minWidth: 120, maxWidth: 552, defaultWidth: 552, minThickness: 1, maxThickness: 8, defaultThickness: 1 },
  map: { minZoom: 12, maxZoom: 19, defaultZoom: 15, minHeight: 200, maxHeight: 400, defaultHeight: 300 },
  lineup: { maxMembers: 3 },
  blogPostsList: { minItems: 1, maxItems: 10, defaultItems: 3 },
  summary: { descriptionMaxChars: 150 },
} as const;

/** Clampa `value` entre `min` e `max`, aplicando `fallback` quando nulo/undefined. */
export const clamp = (value: number | null | undefined, min: number, max: number, fallback: number): number =>
  Math.max(min, Math.min(max, value ?? fallback));
