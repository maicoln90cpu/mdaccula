import { describe, it, expect } from 'vitest';
import { renderBlockedTemplate, type Block } from '@/lib/emailTemplates/blocks';
import { MOCK_EVENT_DATA } from '@/lib/emailTemplates/eventAnnouncement';

/**
 * Bloco "Título" (H1) em contexto multi-evento (event_grid): em vez do
 * resumo curto usado no assunto do e-mail (que não pode virar lista — é uma
 * linha só na caixa de entrada), o H1 lista cada evento numa linha própria,
 * com marcador + dia/hora.
 */

const gridItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'ev-1',
  title: 'Krush',
  dayLabel: '22/08',
  timeLabel: '17h',
  venue: 'Clube X',
  imageUrl: 'https://cdn.example.com/krush.jpg',
  eventUrl: 'https://mdaccula.com/eventos/krush',
  ticketUrl: 'https://mdaccula.com/eventos/krush',
  ...overrides,
});

describe('title — lista de eventos quando há gridEvents (multi-evento) e nenhum override', () => {
  it('renderiza cada evento numa linha própria, com marcador e dia/hora', () => {
    const event = {
      ...MOCK_EVENT_DATA,
      gridEvents: [
        gridItem({ id: 'a', title: 'BOMA presents: The Moment', dayLabel: '22/08', timeLabel: '17h' }),
        gridItem({ id: 'b', title: 'Nostalgia', dayLabel: '23/08', timeLabel: '22h' }),
      ],
    };
    const blocks: Block[] = [{ id: 't', kind: 'title' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    expect(html).toContain('• BOMA presents: The Moment — 22/08 · 17h<br>• Nostalgia — 23/08 · 22h');
  });

  it('text_override continua tendo prioridade sobre a lista', () => {
    const event = { ...MOCK_EVENT_DATA, gridEvents: [gridItem({ id: 'a' }), gridItem({ id: 'b' })] };
    const blocks: Block[] = [{ id: 't', kind: 'title', text_override: 'Promo especial' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    expect(html).toContain('>Promo especial<');
    expect(html).not.toContain('•');
  });

  it('sem gridEvents (template de evento único), mantém o texto simples de sempre', () => {
    const blocks: Block[] = [{ id: 't', kind: 'title' }];
    const html = renderBlockedTemplate(blocks, MOCK_EVENT_DATA, null, null, { preview: true });

    expect(html).toContain(`>${MOCK_EVENT_DATA.eventTitle}<`);
    expect(html).not.toContain('•');
  });

  it('uppercase aplica em cada linha da lista', () => {
    const event = { ...MOCK_EVENT_DATA, gridEvents: [gridItem({ id: 'a', title: 'krush' })] };
    const blocks: Block[] = [{ id: 't', kind: 'title', uppercase: true }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    expect(html).toContain('• KRUSH — 22/08 · 17H');
  });
});
