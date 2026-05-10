/**
 * Sanitização e validação de títulos editoriais para artigos de evento.
 *
 * Bloqueia padrões "ruins" históricos:
 *  - Emojis (☀️ 👁️ etc)
 *  - Separadores mecânicos `|` e ` — ` repetidos
 *  - Datas literais "DD/MM" ou "DD/MM/YYYY"
 *  - Prefixos hediondos "Confira", "Não perca", "Imperdível"
 *
 * Usado pelas edge functions `generate-blog-post-v2` e
 * `generate-multi-event-article` antes de persistir o post.
 */

const EMOJI_REGEX =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{1F900}-\u{1F9FF}\uFE0F\u200D]/gu;

const BAD_PREFIXES = [
  /^confira[:\s]+/i,
  /^não perca[:\s]+/i,
  /^nao perca[:\s]+/i,
  /^imperdível[:\s]+/i,
  /^imperdivel[:\s]+/i,
  /^veja[:\s]+/i,
];

const DATE_LITERAL_REGEX = /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g;

export interface TitleValidation {
  valid: boolean;
  issues: string[];
  cleaned: string;
}

/**
 * Sanitiza título: remove emojis e prefixos ruins, normaliza espaços.
 * NÃO remove `|`, `—` ou datas — apenas reporta como issue (decisão do
 * caller: regenerar ou deixar passar).
 */
export function sanitizeTitle(raw: string): string {
  let out = (raw ?? "").replace(EMOJI_REGEX, "").trim();
  for (const prefix of BAD_PREFIXES) {
    out = out.replace(prefix, "").trim();
  }
  // colapsa espaços duplos
  return out.replace(/\s{2,}/g, " ").trim();
}

/**
 * Valida título contra todas as regras editoriais.
 * Retorna {valid, issues, cleaned} para a edge function decidir
 * se aceita ou solicita regeneração ao modelo.
 */
export function validateTitle(raw: string): TitleValidation {
  const cleaned = sanitizeTitle(raw);
  const issues: string[] = [];

  if (EMOJI_REGEX.test(raw)) issues.push("contém emoji");
  if (raw.includes("|")) issues.push("contém separador '|'");
  if (raw.includes(" — ") || raw.includes(" – ")) issues.push("contém separador ' — '");
  if (DATE_LITERAL_REGEX.test(raw)) issues.push("contém data literal DD/MM");
  if (cleaned.length < 30) issues.push("muito curto (<30 chars)");
  if (cleaned.length > 100) issues.push("muito longo (>100 chars)");

  return { valid: issues.length === 0, issues, cleaned };
}
