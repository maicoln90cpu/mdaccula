/**
 * Regressão R-003 — "Marcar como enviado" no Controle Pessoal falhava com
 * erro de constraint (relatado inicialmente como "erro de RLS").
 *
 * Bug original (julho/2026):
 *   `EmailPersonalControl.markManual()` grava mode: "manual" em
 *   event_email_campaigns, mas a CHECK constraint da coluna `mode`
 *   só permitia ('draft','immediate','scheduled') desde a criação da
 *   tabela — toda marcação manual falhava com
 *   "violates check constraint event_email_campaigns_mode_check".
 *
 * Correção:
 *   Migration supabase/migrations/20260714120001_fix_manual_mode_check.sql
 *   recria a constraint incluindo 'manual'.
 *
 * Este teste é estático (sem rede): garante que o valor gravado pelo
 * frontend e o valor aceito pela constraint mais recente continuam
 * sincronizados, para que ninguém reintroduza o descompasso editando
 * um dos dois lados sem o outro.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf-8");

function latestModeCheckConstraint(): string | null {
  const dir = path.join(process.cwd(), "supabase/migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  let lastMatch: string | null = null;
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), "utf-8");
    const matches = sql.match(/event_email_campaigns_mode_check["'\s]*\s*CHECK\s*\(mode IN \(([^)]+)\)\)/gi);
    if (matches && matches.length > 0) {
      lastMatch = matches[matches.length - 1];
    }
  }
  return lastMatch;
}

describe("Regressão R-003 — mode 'manual' em event_email_campaigns", () => {
  it("EmailPersonalControl.markManual continua gravando mode: \"manual\"", () => {
    const c = read("src/components/admin/EmailPersonalControl.tsx");
    expect(c).toMatch(/mode:\s*"manual"/);
  });

  it("A CHECK constraint mais recente de event_email_campaigns.mode permite 'manual'", () => {
    const constraint = latestModeCheckConstraint();
    expect(
      constraint,
      "Nenhuma migration define event_email_campaigns_mode_check. " +
        "Veja docs/TESTING.md → Regressões cobertas → R-003."
    ).toBeTruthy();
    expect(
      constraint,
      `A constraint mais recente (${constraint}) não inclui 'manual'. ` +
        "Isso REINTRODUZ a regressão R-003 (Marcar como enviado falha no Controle Pessoal). " +
        "Veja docs/TESTING.md → Regressões cobertas."
    ).toMatch(/'manual'/);
  });
});
