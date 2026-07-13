/**
 * Fonte única de limites/defaults numéricos dos blocos de e-mail (frontend).
 *
 * Este arquivo é espelhado em `supabase/functions/_shared/emailBlocksLimits.ts`
 * (mesmo conteúdo). O teste `src/__tests__/contracts/email-blocks-limits.test.ts`
 * garante que os dois arquivos NÃO divergem — impedindo bugs como o cap de 5
 * posts no blog_posts_list (o edge dizia 10, o frontend dizia 5).
 *
 * Se você alterar aqui, altere também em `supabase/functions/_shared/emailBlocksLimits.ts`.
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
