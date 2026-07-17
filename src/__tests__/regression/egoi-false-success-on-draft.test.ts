/**
 * Regressão R-008 — "Enviar agora" reportava sucesso mesmo quando a E-goi
 * mantinha a campanha como rascunho.
 *
 * Bug original (julho/2026):
 *   `create-event-email-campaign/index.ts` julgava sucesso só pelo status HTTP
 *   (`created.ok` / `sendRes.ok`), sem inspecionar o corpo da resposta da E-goi.
 *   Se `send_now=true` mas a extração do `campaignHash` da resposta de criação
 *   falhasse, o envio era silenciosamente pulado — a função retornava
 *   `status: 'draft', ok: true, error: null` como se tudo tivesse dado certo.
 *   No frontend, `dispatchBatch` (EmailConfig.tsx) e `dispatchAbTest` (hoje em
 *   EmailEventsTab.tsx, após a unificação das abas "Controle pessoal" e
 *   "Histórico") decidiam o toast de sucesso pela flag local `sendNow` +
 *   `res.ok`, nunca por `res.status === 'sent'` — então mesmo um
 *   `status: 'draft'` correto do backend aparecia como "E-mail enviado!" na tela.
 *
 * Correção:
 *   - `sendNow && !campaignHash` vira erro explícito (não silencioso).
 *   - Resposta de `actions/send` é inspecionada além do `.ok` (corpo com
 *     `error`/`errors`/`status:'error'` também conta como falha).
 *   - `egoi_config.segment_id` passa a ser incluído no payload de criação.
 *   - `dispatchBatch`/`dispatchAbTest` só mostram "E-mail enviado!" quando
 *     `res.status === 'sent'`.
 *
 * Este teste é estático (sem rede): lê o código-fonte e garante que essas
 * checagens continuam presentes.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf-8");

describe("Regressão R-008 — status real da E-goi antes de reportar sucesso", () => {
  it("create-event-email-campaign trata sendNow sem campaignHash como erro explícito", () => {
    const src = read("supabase/functions/create-event-email-campaign/index.ts");
    expect(
      src,
      "Não encontrei o guard 'sendNow && !campaignHash'. Isso REINTRODUZ a regressão R-008 " +
        "(envio pulado silenciosamente quando o hash da campanha não pode ser extraído). " +
        "Veja docs/TESTING.md → Regressões cobertas."
    ).toMatch(/sendNow\s*&&\s*!campaignHash/);
  });

  it("create-event-email-campaign inspeciona o corpo da resposta de actions/send, não só o status HTTP", () => {
    const src = read("supabase/functions/create-event-email-campaign/index.ts");
    const sendBlockMatch = src.match(/actions\/send[\s\S]{0,1200}/);
    expect(sendBlockMatch, "Não encontrei a chamada .../actions/send.").toBeTruthy();
    expect(
      sendBlockMatch![0],
      "A checagem de sucesso do envio deve inspecionar o corpo da resposta (ex.: body.error), " +
        "não confiar só em sendRes.ok — senão a E-goi pode responder 2xx com erro no corpo e " +
        "isso passa despercebido (regressão R-008)."
    ).toMatch(/bodyIndicatesError|sendRes\.body\?\.error/);
  });

  it("createPayload inclui segment_id quando configurado", () => {
    const src = read("supabase/functions/create-event-email-campaign/index.ts");
    expect(
      src,
      "createPayload não referencia mais cfg.segment_id — segmento configurado na agência " +
        "deixaria de ser enviado à E-goi."
    ).toMatch(/createPayload\.segment_id\s*=\s*Number\(cfg\.segment_id\)/);
  });

  it("dispatchBatch (EmailConfig.tsx) só mostra 'enviado' quando res.status === 'sent'", () => {
    const src = read("src/pages/admin/EmailConfig.tsx");
    const fnMatch = src.match(/const dispatchBatch[\s\S]*?\n  };/);
    expect(fnMatch, "Não encontrei a função dispatchBatch em EmailConfig.tsx.").toBeTruthy();
    const fnSrc = fnMatch![0];
    expect(
      fnSrc,
      "dispatchBatch precisa checar res.status === 'sent' antes de mostrar 'E-mail enviado!' — " +
        "decidir o toast só por res.ok + a flag local sendNow REINTRODUZ a regressão R-008 " +
        "(campanha em rascunho reportada como enviada)."
    ).toMatch(/res\.status\s*===\s*["']sent["']/);
    expect(fnSrc).toMatch(/res\.status\s*===\s*["']draft["']/);
  });

  it("dispatchAbTest (EmailEventsTab.tsx) checa status por variante, não só .ok", () => {
    const src = read("src/components/admin/emailConfig/EmailEventsTab.tsx");
    const fnMatch = src.match(/async function dispatchAbTest[\s\S]*?\n  \}/);
    expect(fnMatch, "Não encontrei a função dispatchAbTest em EmailEventsTab.tsx.").toBeTruthy();
    const fnSrc = fnMatch![0];
    expect(
      fnSrc,
      "dispatchAbTest precisa checar res.variantA/B.status === 'sent' — julgar sucesso só por " +
        ".ok REINTRODUZ a mesma regressão R-008 no fluxo de teste A/B."
    ).toMatch(/variantA\.status\s*===\s*["']sent["']/);
    expect(fnSrc).toMatch(/variantB\.status\s*===\s*["']sent["']/);
  });
});
