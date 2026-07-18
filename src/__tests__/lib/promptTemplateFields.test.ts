import { describe, it, expect } from "vitest";
import { normalizePromptTemplateFields } from "@/lib/promptTemplateFields";

describe("normalizePromptTemplateFields", () => {
  it("separa allFields (todos) de requiredFields (só true)", () => {
    const result = normalizePromptTemplateFields({
      nome_evento: true,
      lineup: false,
      data: false,
      link: true,
    });
    expect(result.allFields).toEqual(["nome_evento", "lineup", "data", "link"]);
    expect(result.requiredFields).toEqual(["nome_evento", "link"]);
  });

  it("campo marcado como opcional (false) não entra em requiredFields", () => {
    const result = normalizePromptTemplateFields({ lineup: false });
    expect(result.allFields).toEqual(["lineup"]);
    expect(result.requiredFields).toEqual([]);
  });

  it("array legado: todo campo é tratado como obrigatório", () => {
    const result = normalizePromptTemplateFields(["nome_evento", "data"]);
    expect(result.allFields).toEqual(["nome_evento", "data"]);
    expect(result.requiredFields).toEqual(["nome_evento", "data"]);
  });

  it("null/undefined retorna listas vazias", () => {
    expect(normalizePromptTemplateFields(null)).toEqual({ allFields: [], requiredFields: [] });
    expect(normalizePromptTemplateFields(undefined)).toEqual({ allFields: [], requiredFields: [] });
  });

  it("objeto vazio retorna listas vazias", () => {
    expect(normalizePromptTemplateFields({})).toEqual({ allFields: [], requiredFields: [] });
  });
});
