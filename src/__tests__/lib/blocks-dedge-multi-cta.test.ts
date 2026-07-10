import { describe, it, expect } from 'vitest';
import { renderBlockedTemplate, type Block } from '@/lib/emailTemplates/blocks';
import { MOCK_EVENT_DATA } from '@/lib/emailTemplates/eventAnnouncement';

describe('bloco dedge_block — N noites geram N botões', () => {
  it('renderiza um botão por noite habilitada, cada um com URL própria', () => {
    const event = {
      ...MOCK_EVENT_DATA,
      dedge: {
        imageUrl: 'https://example.com/dedge.jpg',
        nights: [
          { label: 'Quinta — Progressive', url: 'https://ex.com/qui', enabled: true },
          { label: 'Sexta — Melodic', url: 'https://ex.com/sex', enabled: true },
          { label: 'Sábado — Tech', url: 'https://ex.com/sab', enabled: true },
          { label: 'Domingo — Deep', url: 'https://ex.com/dom', enabled: true },
        ],
      },
    };
    const blocks: Block[] = [{ id: 'd', kind: 'dedge_block', button_style: 'dark' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });
    expect(html).toContain('https://ex.com/qui');
    expect(html).toContain('https://ex.com/sex');
    expect(html).toContain('https://ex.com/sab');
    expect(html).toContain('https://ex.com/dom');
    expect(html).toContain('Quinta');
    expect(html).toContain('Domingo');
  });

  it('não renderiza noites desabilitadas', () => {
    const event = {
      ...MOCK_EVENT_DATA,
      dedge: {
        imageUrl: 'https://example.com/dedge.jpg',
        nights: [
          { label: 'ATIVA_MARKER', url: 'https://ex.com/on', enabled: true },
          { label: 'DESLIGADA_MARKER', url: 'https://ex.com/off', enabled: false },
        ],
      },
    };
    const blocks: Block[] = [{ id: 'd', kind: 'dedge_block', button_style: 'dark' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });
    expect(html).toContain('ATIVA_MARKER');
    expect(html).not.toContain('DESLIGADA_MARKER');
  });
});
