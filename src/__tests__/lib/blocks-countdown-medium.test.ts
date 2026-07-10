import { describe, it, expect } from 'vitest';
import { renderBlockedTemplate, type Block } from '@/lib/emailTemplates/blocks';
import { MOCK_EVENT_DATA } from '@/lib/emailTemplates/eventAnnouncement';

/**
 * Regressão: contagem "Médio" deve mostrar HORAS/MIN (não DIAS/HORAS).
 */
describe('countdown size=medium — horas/minutos', () => {
  it('renderiza rótulos "horas" e "min", nunca "dias"', () => {
    const event = {
      ...MOCK_EVENT_DATA,
      ticketBatchDeadlineIso: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
    };
    const blocks: Block[] = [
      { id: 'c', kind: 'countdown', size: 'medium', deadline_source: 'batch_deadline' },
    ];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });
    expect(html.toLowerCase()).toContain('horas');
    expect(html.toLowerCase()).toContain('min');
    expect(html.toLowerCase()).not.toContain('dias');
  });
});
