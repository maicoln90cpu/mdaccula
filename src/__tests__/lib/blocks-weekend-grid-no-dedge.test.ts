import { describe, it, expect } from 'vitest';
import { renderBlockedTemplate, type Block } from '@/lib/emailTemplates/blocks';
import { MOCK_EVENT_DATA } from '@/lib/emailTemplates/eventAnnouncement';

/**
 * Regressão: DEDGE não deve aparecer no bloco `weekend_grid` — só via `dedge_block`.
 * O bloco filtra qualquer evento cujo venue case com /d\.?\s*edge/i.
 */
describe('weekend_grid — filtro defensivo DEDGE', () => {
  it('não renderiza eventos com venue "D.EDGE" ou "Dedge" na agenda', () => {
    const event = {
      ...MOCK_EVENT_DATA,
      weekendEvents: [
        {
          id: 'ev-1',
          title: 'NOSTALGIA_MARKER',
          dayLabel: 'Sábado, 25/05',
          timeLabel: '22h',
          venue: 'Nostalgia',
          cityState: 'São Paulo-SP',
          imageUrl: 'https://ex.com/n.jpg',
          eventUrl: 'https://ex.com/n',
        },
        {
          id: 'ev-2',
          title: 'DEDGE_MARKER',
          dayLabel: 'Sexta, 24/05',
          timeLabel: '23h',
          venue: 'D.Edge',
          cityState: 'São Paulo-SP',
          imageUrl: 'https://ex.com/d.jpg',
          eventUrl: 'https://ex.com/d',
        },
      ],
    };
    const blocks: Block[] = [{ id: 'w', kind: 'weekend_grid', layout: 'cartaz' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });
    expect(html).toContain('NOSTALGIA_MARKER');
    expect(html).not.toContain('DEDGE_MARKER');
  });
});
