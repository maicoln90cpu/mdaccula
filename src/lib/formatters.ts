/**
 * Formatters compartilhados (pt-BR).
 *
 * Centraliza formatação numérica/data para evitar divergências entre
 * componentes. Antes: `formatCount` estava duplicado em EmailConfig.tsx
 * e EmailDashboard.tsx.
 */

/**
 * Formata um número inteiro no padrão pt-BR (separador de milhar).
 * Retorna "—" quando o valor é null/undefined.
 *
 * @example formatCount(1234) // "1.234"
 * @example formatCount(null) // "—"
 */
export const formatCount = (n: number | null | undefined): string =>
  typeof n === "number" ? n.toLocaleString("pt-BR") : "—";

/**
 * Formata um ISO string / Date em data + hora pt-BR (dd/mm/aaaa hh:mm:ss).
 * Fallback seguro: nunca lança. Retorna:
 *  - "—" para null / undefined / string vazia
 *  - a string original para datas inválidas (ex.: "abc")
 *
 * @example formatDateTimeBR("2026-07-13T15:30:00Z") // "13/07/2026 12:30:00" (BRT)
 * @example formatDateTimeBR(null) // "—"
 * @example formatDateTimeBR("abc") // "abc" (não quebra a UI)
 */
export const formatDateTimeBR = (
  input: string | number | Date | null | undefined,
): string => {
  if (input === null || input === undefined || input === "") return "—";
  try {
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return String(input);
    return d.toLocaleString("pt-BR");
  } catch {
    return String(input);
  }
};

/**
 * Versão só-data (dd/mm/aaaa), mesmo contrato de fallback do `formatDateTimeBR`.
 */
export const formatDateBR = (
  input: string | number | Date | null | undefined,
): string => {
  if (input === null || input === undefined || input === "") return "—";
  try {
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return String(input);
    return d.toLocaleDateString("pt-BR");
  } catch {
    return String(input);
  }
};
