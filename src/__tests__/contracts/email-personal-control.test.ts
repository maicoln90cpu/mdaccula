import { describe, expect, it } from "vitest";
import fs from "fs";

const read = (p: string) => fs.readFileSync(`${process.cwd()}/${p}`, "utf-8");

describe("Contract: aba Controle pessoal", () => {
  it("EmailConfig registra o trigger e o content da aba 'controle'", () => {
    const c = read("src/pages/admin/EmailConfig.tsx");
    expect(c).toContain('<TabsTrigger value="controle"');
    expect(c).toContain('<TabsContent value="controle"');
    expect(c).toContain("EmailPersonalControl");
  });

  it("EmailPersonalControl usa apenas campos existentes de event_email_campaigns", () => {
    const c = read("src/components/admin/EmailPersonalControl.tsx");
    expect(c).toContain('from("event_email_campaigns")');
    expect(c).toContain('from("events")');
    // Marcação manual grava mode/status/campaign_type
    expect(c).toMatch(/mode:\s*"manual"/);
    expect(c).toMatch(/status:\s*"sent"/);
    expect(c).toMatch(/campaign_type:\s*"manual"/);
    // Não referencia colunas inexistentes
    expect(c).not.toMatch(/\bsubject\b\s*:/);
    expect(c).not.toMatch(/\brecipient_count\b/);
  });
});
