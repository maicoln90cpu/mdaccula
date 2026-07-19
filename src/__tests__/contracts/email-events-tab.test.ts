import { describe, expect, it } from 'vitest';
import fs from 'fs';

const read = (p: string) => fs.readFileSync(`${process.cwd()}/${p}`, 'utf-8');

describe("Contract: aba unificada 'Histórico e controle'", () => {
  it("EmailConfig registra o trigger e o content da aba 'eventos'", () => {
    const c = read('src/pages/admin/EmailConfig.tsx');
    expect(c).toContain('<TabsTrigger value="eventos"');
    expect(c).toContain('<TabsContent value="eventos"');
    expect(c).toContain('EmailEventsTab');
  });

  it('EmailEventsTab usa apenas campos existentes de event_email_campaigns', () => {
    const c = read('src/components/admin/emailConfig/EmailEventsTab.tsx');
    expect(c).toContain("from('event_email_campaigns')");
    expect(c).toContain("from('events')");
    // Marcação manual grava mode/status/campaign_type
    expect(c).toMatch(/mode:\s*'manual'/);
    expect(c).toMatch(/status:\s*'sent'/);
    expect(c).toMatch(/campaign_type:\s*'manual'/);
    // Não referencia colunas inexistentes
    expect(c).not.toMatch(/\bsubject\b\s*:/);
    expect(c).not.toMatch(/\brecipient_count\b/);
  });
});
