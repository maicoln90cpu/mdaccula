/**
 * Normaliza `ai_prompt_templates.required_fields` (coluna JSON `{campo: boolean}`,
 * ou array legado onde todo campo é obrigatório) em duas listas: todos os campos
 * configurados (pra renderizar o formulário) e só os campos com `true` (pra bloquear
 * a geração). Ver PENDENCIAS.MD/CHANGELOG — antes disso, `Object.keys()` tratava
 * campo opcional como obrigatório por descartar o booleano.
 */
export function normalizePromptTemplateFields(
  requiredFields: unknown
): { allFields: string[]; requiredFields: string[] } {
  if (Array.isArray(requiredFields)) {
    const fields = requiredFields as string[];
    return { allFields: fields, requiredFields: fields };
  }
  if (typeof requiredFields === "object" && requiredFields !== null) {
    const entries = Object.entries(requiredFields as Record<string, boolean>);
    return {
      allFields: entries.map(([field]) => field),
      requiredFields: entries.filter(([, isRequired]) => isRequired === true).map(([field]) => field),
    };
  }
  return { allFields: [], requiredFields: [] };
}
