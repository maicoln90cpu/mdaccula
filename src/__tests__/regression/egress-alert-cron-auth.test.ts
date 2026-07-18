/**
 * Regressão R-013 — Monitor de Egress nunca alertava e o botão manual sempre falhava.
 *
 * Bug original (julho/2026):
 *   - `egress-alert-cron/index.ts` nunca foi agendado via pg_cron em nenhuma
 *     migration — a aba "Alertas" do Monitor de Egress ficava sempre vazia.
 *   - O botão "Executar verificação agora" (`EgressAlertsCard.tsx`) chamava
 *     `supabase.functions.invoke("egress-alert-cron", { headers: {} })`, mas
 *     a função exigia `x-cron-secret === CRON_SHARED_SECRET` sem NENHUM
 *     fallback — o botão sempre recebia 401, estruturalmente quebrado.
 *
 * Correção:
 *   - `egress-alert-cron/index.ts` passa a aceitar x-cron-secret validado
 *     contra `internal_cron_secrets` (name='egress_alert_cron') OU
 *     Authorization Bearer de um admin autenticado, além do
 *     CRON_SHARED_SECRET original — mesmo padrão de authorizeAdminOrCron
 *     usado em scan-event-sources/weekly-digest-draft.
 *   - `EgressAlertsCard.tsx` não sobrescreve mais o Authorization padrão que
 *     o supabase-js anexa automaticamente à sessão do admin.
 *   - Nova migration agenda o cron diário via internal_cron_secrets + net.http_post.
 *
 * Este teste é estático (sem rede): lê o código-fonte e garante que essas
 * checagens continuam presentes.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf-8");

describe("Regressão R-013 — auth do egress-alert-cron aceita cron e admin, botão manual não sobrescreve Authorization", () => {
  it("egress-alert-cron aceita x-cron-secret validado contra internal_cron_secrets", () => {
    const src = read("supabase/functions/egress-alert-cron/index.ts");
    expect(
      src,
      "egress-alert-cron precisa consultar internal_cron_secrets (name='egress_alert_cron') " +
        "como fallback de autenticação do cron — sem isso, a migration de agendamento não autentica."
    ).toMatch(/internal_cron_secrets/);
    expect(src).toMatch(/egress_alert_cron/);
  });

  it("egress-alert-cron aceita Authorization Bearer de admin autenticado (fallback do botão manual)", () => {
    const src = read("supabase/functions/egress-alert-cron/index.ts");
    expect(
      src,
      "egress-alert-cron precisa validar um Authorization Bearer de admin (has_role) como caminho " +
        "alternativo de auth — sem isso, o botão 'Executar verificação agora' sempre retorna 401 " +
        "(regressão R-013), já que o client nunca tem acesso ao CRON_SHARED_SECRET."
    ).toMatch(/authHeader/);
    expect(src).toMatch(/has_role/);
  });

  it("EgressAlertsCard não sobrescreve mais o Authorization padrão ao chamar egress-alert-cron", () => {
    const src = read("src/components/admin/EgressAlertsCard.tsx");
    expect(
      src,
      "EgressAlertsCard voltou a passar 'headers: {}' para functions.invoke('egress-alert-cron') — " +
        "isso REINTRODUZ a regressão R-013 (botão manual sempre 401)."
    ).not.toMatch(/egress-alert-cron[\s\S]{0,60}headers:\s*\{\s*\}/);
  });

  it("existe uma migration agendando egress-alert-cron via pg_cron", () => {
    const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
    const files = fs.readdirSync(migrationsDir);
    const scheduled = files.some((f) => {
      if (!f.endsWith(".sql")) return false;
      const content = fs.readFileSync(path.join(migrationsDir, f), "utf-8");
      return content.includes("egress-alert-cron") && content.includes("cron.schedule");
    });
    expect(
      scheduled,
      "Nenhuma migration agenda egress-alert-cron via cron.schedule — sem isso, os alertas " +
        "automáticos nunca disparam (a causa raiz original da regressão R-013)."
    ).toBe(true);
  });
});
