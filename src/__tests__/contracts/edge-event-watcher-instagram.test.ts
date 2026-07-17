/**
 * Contract test (estático) — Fase B do Event Watcher: monitoramento de
 * Instagram via Apify (scan-event-sources dispara, apify-instagram-webhook
 * recebe) + composição de imagem com a marca MDAccula (compose-event-image),
 * ligada tanto no fluxo de sites quanto no de Instagram.
 *
 * Ver docs/superpowers/plans/2026-07-15-event-watcher-master-roadmap.md,
 * seção "Fase B — Apify (Instagram) + composição de imagem".
 */
import { describe, expect, it } from "vitest";
import fs from "fs";

const read = (path: string) => fs.readFileSync(`${process.cwd()}/${path}`, "utf-8");

describe("Contract: Fase B (Instagram via Apify + compose-event-image)", () => {
  it("scan-event-sources dispara o ator da Apify pras fontes type='instagram'", () => {
    const content = read("supabase/functions/scan-event-sources/index.ts");

    expect(content).toContain('source.type === "instagram"');
    expect(content).toContain("api.apify.com/v2/acts/instaprism~instagram-post-monitor/runs");
    expect(content).toContain("apify-instagram-webhook");
    // A query de fontes não pode mais filtrar só 'site' — precisa trazer as duas.
    expect(content).not.toContain('.eq("type", "site")');
  });

  it("scan-event-sources chama compose-event-image antes de gerar o artigo (fluxo de sites)", () => {
    const content = read("supabase/functions/scan-event-sources/index.ts");

    expect(content).toContain("composeEventImage");
    expect(content).toContain("/functions/v1/compose-event-image");
    expect(content).toContain("finalImageUrl");
  });

  it("apify-instagram-webhook valida o secret, loga o payload bruto e nunca reenvia ticket_link pro gerador", () => {
    const content = read("supabase/functions/apify-instagram-webhook/index.ts");

    expect(content).toContain("apify_instagram_webhook");
    expect(content).toContain("logRawPayload");

    // O corpo enviado a generate-blog-post-v2 (entre a URL da function e o
    // fetchWithTimeout seguinte) nunca pode incluir o campo ticket_link/ticketLink —
    // checa só esse trecho, não o arquivo inteiro (que legitimamente menciona
    // "ticket_link" em comentários e no insert do rascunho).
    const generateCallMatch = content.match(
      /functions\/v1\/generate-blog-post-v2[\s\S]{0,900}/,
    );
    expect(generateCallMatch, "Não encontrei a chamada a generate-blog-post-v2").toBeTruthy();
    expect(generateCallMatch![0]).not.toMatch(/ticket_?link/i);
  });

  it("apify-instagram-webhook nunca chama EdgeRuntime.waitUntil (decisão deliberada, evita o BOOT_ERROR)", () => {
    const content = read("supabase/functions/apify-instagram-webhook/index.ts");

    // Checa a CHAMADA real (com parênteses) — o arquivo comenta a decisão de não
    // usar waitUntil, então "EdgeRuntime.waitUntil" sozinho aparece em prosa.
    expect(content).not.toMatch(/EdgeRuntime\.waitUntil\(/);
  });

  it("compose-event-image é standalone: sem import de _shared, sem chamada a EdgeRuntime.waitUntil", () => {
    const content = read("supabase/functions/compose-event-image/index.ts");

    expect(content).not.toMatch(/from\s+["']\.\.\/_shared/);
    expect(content).not.toMatch(/EdgeRuntime\.waitUntil\(/);
    // Nunca usar encodeWEBP — imagescript não suporta (nem decode nem encode).
    expect(content).not.toMatch(/\.encodeWEBP\(/);
  });

  it("config.toml expõe apify-instagram-webhook sem verify_jwt (a Apify não manda JWT do Supabase)", () => {
    const content = read("supabase/config.toml");

    expect(content).toMatch(/\[functions\.apify-instagram-webhook\]\s*\nverify_jwt = false/);
  });
});
