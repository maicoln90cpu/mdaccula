/**
 * Regressão — quando uma Edge Function de geração de conteúdo respondia com
 * uma mensagem de erro clara (ex.: "Nenhuma fonte real encontrada para..."),
 * o admin nunca via essa mensagem — só um toast genérico ("Erro ao gerar
 * artigo"). Causa: `supabase.functions.invoke()` só expõe o corpo JSON de
 * erro via `error.context.json()` (Response bruto); `error.message` sozinho
 * é a mensagem genérica do SDK.
 *
 * Proteção: getEdgeFunctionErrorMessage (src/lib/edgeFunctionErrorMessage.ts,
 * testado em src/__tests__/lib/edgeFunctionErrorMessage.test.ts) extrai a
 * mensagem real. Este teste garante que todo handler de geração em
 * AIContent2.tsx continua usando esse helper, não o padrão antigo.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf-8");

const OLD_GENERIC_PATTERN = 'error instanceof Error ? error.message : "Erro desconhecido"';

describe("Regressão — mensagens de erro reais das Edge Functions chegam ao admin", () => {
  it("AIContent2.tsx usa getEdgeFunctionErrorMessage nos handlers de geração de conteúdo", () => {
    const content = read("src/pages/admin/AIContent2.tsx");

    expect(content).toContain('getEdgeFunctionErrorMessage } from "@/lib"');

    const handlers = ["handleGenerate", "handleGenerateFromTopic", "handleGenerateFromSuggestion", "handleGenerateSelected"];
    for (const handlerName of handlers) {
      const fnMatch = content.match(new RegExp(`const ${handlerName} = async[\\s\\S]*?\\n  \\};`));
      expect(fnMatch, `Não encontrei a função ${handlerName} em AIContent2.tsx.`).toBeTruthy();

      const snippet = fnMatch![0];
      expect(
        snippet,
        `${handlerName} usa getEdgeFunctionErrorMessage?`
      ).toContain("getEdgeFunctionErrorMessage(");
      expect(
        snippet,
        `${handlerName} REGRIDIU pro padrão genérico antigo (${OLD_GENERIC_PATTERN}), que nunca mostra a mensagem real do backend.`
      ).not.toContain(OLD_GENERIC_PATTERN);
    }
  });
});
