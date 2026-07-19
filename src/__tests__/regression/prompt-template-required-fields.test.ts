/**
 * Regressão — campo marcado como opcional (false) num ai_prompt_templates.required_fields
 * bloqueava a geração de conteúdo como se fosse obrigatório.
 *
 * Causa: AIContent2.tsx normalizava required_fields (JSON {campo: boolean}) com
 * Object.keys(), que pega todas as chaves e descarta o valor. normalizePromptTemplateFields
 * (src/lib/promptTemplateFields.ts) é a fonte única dessa normalização agora — deve
 * sempre separar allFields (todas as chaves, pro formulário) de requiredFields (só as
 * marcadas true, pro bloqueio de geração).
 */
import { describe, it, expect } from 'vitest';
import { normalizePromptTemplateFields } from '@/lib/promptTemplateFields';

describe('Regressão — campo opcional do template não bloqueia mais a geração', () => {
  it('campo marcado como false não entra em requiredFields, mas continua em allFields', () => {
    const { allFields, requiredFields } = normalizePromptTemplateFields({
      nome_evento: true,
      lineup: false,
      data_evento: false,
      link_ingresso: false,
    });

    expect(allFields).toContain('lineup');
    expect(allFields).toContain('data_evento');
    expect(allFields).toContain('link_ingresso');
    expect(requiredFields).toEqual(['nome_evento']);
    expect(requiredFields).not.toContain('lineup');
    expect(requiredFields).not.toContain('data_evento');
    expect(requiredFields).not.toContain('link_ingresso');
  });
});
