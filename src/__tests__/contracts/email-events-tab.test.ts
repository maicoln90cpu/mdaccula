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
    const data = read('src/components/admin/emailConfig/emailEventsTab/useEmailEventsData.ts');
    const actions = read('src/components/admin/emailConfig/emailEventsTab/useEventActions.ts');
    expect(data).toContain("from('event_email_campaigns')");
    expect(data).toContain("from('events')");
    // Marcação manual grava mode/status/campaign_type
    expect(actions).toMatch(/mode:\s*'manual'/);
    expect(actions).toMatch(/status:\s*'sent'/);
    expect(actions).toMatch(/campaign_type:\s*'manual'/);
    // Não referencia colunas inexistentes
    const all = data + actions;
    expect(all).not.toMatch(/\bsubject\b\s*:/);
    expect(all).not.toMatch(/\brecipient_count\b/);
  });
});
