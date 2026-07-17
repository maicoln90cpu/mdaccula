/**
 * Guarda de regressão — agendamento de disparo ("agendar" na aba "Envio
 * manual") não pode reintroduzir as regressões já corrigidas no envio
 * imediato:
 *
 *   R-004: a chamada POST .../actions/send da E-goi exige list_id no corpo —
 *          corpo vazio `{}` já causou 422 list_id.isEmpty.
 *   R-007/R-008: um HTTP 2xx sozinho não confirma envio — é preciso inspecionar
 *          o corpo da resposta (error/errors/status:'error') antes de marcar
 *          a campanha como 'sent'.
 *
 * O agendamento introduz DUAS novas chamadas de rede que precisam da mesma
 * defensividade: a criação do rascunho agendado em create-event-email-campaign
 * (schedule_at) e o disparo real em send-scheduled-email-campaigns (poller de
 * cron). Este teste é estático (sem rede): lê o código-fonte de ambas.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf-8");

describe("Regressão — agendamento de disparo não regride R-004/R-007/R-008", () => {
  it("create-event-email-campaign valida schedule_at (futuro, mutuamente exclusivo com send_now)", () => {
    const src = read("supabase/functions/create-event-email-campaign/index.ts");
    expect(
      src,
      "Não encontrei a checagem de mútua exclusão entre schedule_at e send_now."
    ).toMatch(/scheduleAtRaw\s*&&\s*sendNow/);
    expect(
      src,
      "Não encontrei a checagem de schedule_at no futuro (mín. 1 minuto)."
    ).toMatch(/scheduleAtMs\s*<\s*Date\.now\(\)/);
  });

  it("create-event-email-campaign exige campaignHash para agendar (mesma defesa do envio imediato)", () => {
    const src = read("supabase/functions/create-event-email-campaign/index.ts");
    expect(
      src,
      "Não encontrei o guard 'scheduleAtIso && !campaignHash'. Sem isso, um agendamento pode " +
        "ser salvo sem hash de campanha válido — o poller nunca vai conseguir confirmar o envio depois."
    ).toMatch(/scheduleAtIso\s*&&\s*!campaignHash/);
  });

  it("send-scheduled-email-campaigns inclui list_id no body de actions/send (R-004)", () => {
    const src = read("supabase/functions/send-scheduled-email-campaigns/index.ts");
    const sendCallMatch = src.match(/actions\/send[\s\S]{0,400}/);
    expect(sendCallMatch, "Não encontrei a chamada .../actions/send em send-scheduled-email-campaigns/index.ts.").toBeTruthy();
    const snippet = sendCallMatch![0];
    expect(
      snippet,
      "A chamada .../actions/send não inclui list_id no body — REINTRODUZ a regressão R-004 " +
        "(E-goi 422 list_id.isEmpty) no disparo agendado."
    ).toMatch(/list_id/);
    expect(snippet).not.toMatch(/body:\s*JSON\.stringify\(\{\}\)/);
  });

  it("send-scheduled-email-campaigns inspeciona o corpo da resposta antes de marcar 'sent' (R-007/R-008)", () => {
    const src = read("supabase/functions/send-scheduled-email-campaigns/index.ts");
    expect(
      src,
      "send-scheduled-email-campaigns precisa checar egoiSendBodyIndicatesError (ou equivalente) " +
        "antes de marcar status:'sent' — confiar só em sendRes.ok REINTRODUZ R-007/R-008 no disparo agendado."
    ).toMatch(/egoiSendBodyIndicatesError/);
    expect(
      src,
      "A condição de sucesso deve combinar sendRes.ok E a ausência de erro no corpo."
    ).toMatch(/sendRes\.ok\s*&&\s*!egoiSendBodyIndicatesError/);
  });

  it("_shared/egoiClient.ts centraliza a checagem de corpo-com-erro usada pelas duas funções", () => {
    const shared = read("supabase/functions/_shared/egoiClient.ts");
    expect(shared).toMatch(/export function egoiSendBodyIndicatesError/);
    const createFn = read("supabase/functions/create-event-email-campaign/index.ts");
    const pollerFn = read("supabase/functions/send-scheduled-email-campaigns/index.ts");
    expect(createFn).toMatch(/from ['"]\.\.\/_shared\/egoiClient\.ts['"]/);
    expect(pollerFn).toMatch(/from ['"]\.\.\/_shared\/egoiClient\.ts['"]/);
  });
});
