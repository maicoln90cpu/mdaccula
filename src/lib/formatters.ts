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
