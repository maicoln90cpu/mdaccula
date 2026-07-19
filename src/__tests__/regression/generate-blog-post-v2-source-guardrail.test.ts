/**
 * Regressão — generate-blog-post-v2 gerava artigos de evento totalmente
 * inventados (lineup/local/horário fabricados) quando um template de
 * categoria Eventos/Festivais era usado sem nenhum dado real por trás (ex.:
 * admin escolhe "Raspagem de Eventos" na aba Gerar e digita só o nome).
 *
 * Casos reais publicados e depois despublicados manualmente: "a liga" e
 * "solomun" (18-19/07/2026), ambos com source_urls null.
 *
 * Proteção: o guardrail (isEventMode && !hasEventSignals) exige busca real
 * via Firecrawl antes de gerar — sem fonte, sem artigo. Ver
 * supabase/functions/_shared/eventSourceGuardrail_test.ts e
 * supabase/functions/_shared/firecrawlSearch_test.ts para os testes da
 * lógica pura (Deno, npm run test:edge). Este teste é um guard estático
 * garantindo que o guardrail não seja removido/desconectado por acidente do
 * fluxo principal.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf-8");

describe("Regressão — generate-blog-post-v2 não gera evento sem fonte real quando não há dado real", () => {
  it("importa e usa o guardrail de verificação de fonte", () => {
    const content = read("supabase/functions/generate-blog-post-v2/index.ts");

    expect(content).toContain('from "../_shared/eventSourceGuardrail.ts"');
    expect(content).toContain("shouldRequireSourceVerification(isEventMode, hasEventSignals)");
  });

  it("bloqueia com 404 e mensagem clara quando a busca real não encontra nada", () => {
    const content = read("supabase/functions/generate-blog-post-v2/index.ts");

    const guardrailMatch = content.match(
      /if \(shouldRequireSourceVerification\(isEventMode, hasEventSignals\)\) \{[\s\S]*?\n    \}/
    );
    expect(guardrailMatch, "Não encontrei o bloco do guardrail em generate-blog-post-v2/index.ts.").toBeTruthy();

    const snippet = guardrailMatch![0];
    expect(snippet).toContain("searchWithFirecrawl(");
    expect(snippet).toContain("guardrailResults.length === 0");
    expect(snippet).toContain("404");
    expect(snippet).toContain("Nenhuma fonte real encontrada");
  });

  it("grava source_urls reais quando o guardrail encontra fontes (não fica sempre null)", () => {
    const content = read("supabase/functions/generate-blog-post-v2/index.ts");

    expect(content).toContain("source_urls: guardrailSourceUrls,");
    // Regressão: se isso voltar a ser `source_urls: null,` hardcoded, o admin
    // perde a rastreabilidade da fonte real usada pelo guardrail.
    expect(content).not.toContain("source_urls: null,");
  });
});
