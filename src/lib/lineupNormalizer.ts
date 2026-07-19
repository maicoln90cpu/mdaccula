/**
 * Normaliza arrays de lineup que vieram "sujos" do CSV/import:
 *  - ["A, B, C"]     → ["A","B","C"]
 *  - ["A; B", "C"]   → ["A","B","C"]
 *  - ["A.", " B "]   → ["A","B"]
 *  - duplicados são preservados (algumas line-ups repetem propositalmente)
 *  - itens não-string são descartados.
 */
export function normalizeLineup(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const item of input) {
    if (typeof item !== 'string') continue;
    item
      .split(/[,;]/)
      .map((s) => s.trim().replace(/\.$/, '').trim())
      .filter(Boolean)
      .forEach((s) => out.push(s));
  }
  return out;
}
