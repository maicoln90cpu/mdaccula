import { describe, it, expect } from 'vitest';
import { renderBlockedTemplate, type Block } from '@/lib/emailTemplates/blocks';
import { MOCK_EVENT_DATA } from '@/lib/emailTemplates/eventAnnouncement';

/**
 * Redesign do card do grid multi-evento (event_grid / weekend_grid "grid"):
 * título sobreposto à imagem (técnica de gradiente já usada em weekly_hero),
 * line-up em chips compactos abaixo da imagem, e colunas configuráveis (2 ou 3).
 */

const gridItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'ev-1',
  title: 'Krush',
  dayLabel: 'Sex, 23/08',
  timeLabel: '22h',
  venue: 'Clube X',
  cityState: 'São Paulo-SP',
  imageUrl: 'https://cdn.example.com/krush.jpg',
  eventUrl: 'https://mdaccula.com/eventos/krush',
  ticketUrl: 'https://mdaccula.com/eventos/krush',
  ...overrides,
});

describe('event_grid — título sobre a imagem', () => {
  it('renderiza o título dentro da faixa de gradiente sobre a imagem, não mais na linha de info', () => {
    const event = { ...MOCK_EVENT_DATA, gridEvents: [gridItem({ title: 'KRUSH_TITLE_MARKER' })] };
    const blocks: Block[] = [{ id: 'g', kind: 'event_grid' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    const gradientIdx = html.indexOf('background-image:linear-gradient(180deg, rgba(0,0,0,0.62)');
    // O alt da imagem também contém o título — busca a ocorrência DEPOIS do
    // gradiente, que é a do link de título na faixa sobreposta à imagem.
    const titleIdxAfterGradient = html.indexOf('KRUSH_TITLE_MARKER', gradientIdx);
    expect(gradientIdx).toBeGreaterThan(-1);
    expect(titleIdxAfterGradient).toBeGreaterThan(gradientIdx);

    // Linha de info (dia/hora + venue) não deve mais conter o título como link.
    const infoRowStart = html.indexOf('padding:10px 14px 14px 14px');
    const infoRowEnd = html.indexOf('</td></tr>', infoRowStart);
    const infoRowHtml = html.slice(infoRowStart, infoRowEnd);
    expect(infoRowHtml).not.toContain('KRUSH_TITLE_MARKER');
  });
});

describe('event_grid — line-up em chips', () => {
  it('mostra até 3 nomes + chip "+N" quando há mais de 3 artistas (2 colunas)', () => {
    const event = {
      ...MOCK_EVENT_DATA,
      gridEvents: [gridItem({ lineup: ['DJ ALPHA', 'DJ BETA', 'DJ GAMMA', 'DJ DELTA'] })],
    };
    const blocks: Block[] = [{ id: 'g', kind: 'event_grid' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    expect(html).toContain('DJ ALPHA');
    expect(html).toContain('DJ BETA');
    expect(html).toContain('DJ GAMMA');
    expect(html).not.toContain('DJ DELTA');
    expect(html).toContain('>+1<');
  });

  it('mostra até 2 nomes + chip "+N" em 3 colunas (card mais estreito)', () => {
    const event = {
      ...MOCK_EVENT_DATA,
      gridEvents: [
        gridItem({ id: 'a', lineup: ['DJ ALPHA', 'DJ BETA', 'DJ GAMMA'] }),
        gridItem({ id: 'b' }),
        gridItem({ id: 'c' }),
      ],
    };
    const blocks: Block[] = [{ id: 'g', kind: 'event_grid', columns: 3 }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    expect(html).toContain('DJ ALPHA');
    expect(html).toContain('DJ BETA');
    expect(html).not.toContain('DJ GAMMA');
    expect(html).toContain('>+1<');
  });

  it('não renderiza a linha de chips quando o evento não tem line-up', () => {
    const event = { ...MOCK_EVENT_DATA, gridEvents: [gridItem({ lineup: [] })] };
    const blocks: Block[] = [{ id: 'g', kind: 'event_grid' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    expect(html).not.toContain('rgba(168,85,247,0.12)');
  });
});

describe('event_grid — colunas configuráveis', () => {
  it('sem o campo columns, renderiza igual a columns:2 (compatibilidade com templates salvos)', () => {
    const event = { ...MOCK_EVENT_DATA, gridEvents: [gridItem({ id: 'a' }), gridItem({ id: 'b' })] };
    const withoutField: Block[] = [{ id: 'g', kind: 'event_grid' }];
    const explicit2: Block[] = [{ id: 'g', kind: 'event_grid', columns: 2 }];

    const htmlWithout = renderBlockedTemplate(withoutField, event, null, null, { preview: true });
    const htmlExplicit = renderBlockedTemplate(explicit2, event, null, null, { preview: true });

    expect(htmlWithout).toBe(htmlExplicit);
    expect(htmlWithout).toContain('width="50%"');
    expect(htmlWithout).toContain('max-width:260px');
  });

  it('columns:3 divide a largura em 33.33/33.33/33.34 e a imagem em 168px, 2 linhas para 4 eventos', () => {
    const event = {
      ...MOCK_EVENT_DATA,
      gridEvents: [
        gridItem({ id: 'a' }),
        gridItem({ id: 'b' }),
        gridItem({ id: 'c' }),
        gridItem({ id: 'd' }),
      ],
    };
    const blocks: Block[] = [{ id: 'g', kind: 'event_grid', columns: 3 }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    // Linha 1 (completa, 3 itens): 33.33/33.33/33.34 (soma exata 100). Linha 2
    // (sobra, 1 item): 15/08/2026 — passa a ocupar 100% da linha (não mais
    // 33.33% fixo), senão a imagem ficava "grudada" à esquerda com 2/3 da
    // linha vazios — bug relatado em produção (R-067, docs/TESTING.md).
    expect((html.match(/width="33\.33%"/g) || []).length).toBe(2);
    expect((html.match(/width="33\.34%"/g) || []).length).toBe(1);
    expect((html.match(/width="100%"/g) || []).length).toBeGreaterThanOrEqual(1);
    expect(html).toContain('max-width:168px');
    // 4 eventos em 3 colunas -> 2 linhas (3 + 1)
    expect((html.match(/<tr><td style="padding:2px 24px;">/g) || []).length).toBe(2);
  });
});

describe('weekend_grid — layout "grid" com 2+ eventos usa o mesmo card compartilhado', () => {
  it('título sobre a imagem, line-up em chips e colunas configuráveis também valem aqui', () => {
    const event = {
      ...MOCK_EVENT_DATA,
      weekendEvents: [
        gridItem({ id: 'w1', title: 'WEEKEND_TITLE_MARKER', lineup: ['DJ UM', 'DJ DOIS'] }),
        gridItem({ id: 'w2' }),
        gridItem({ id: 'w3' }),
      ],
    };
    const blocks: Block[] = [{ id: 'w', kind: 'weekend_grid', layout: 'grid', columns: 3 }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    const gradientIdx = html.indexOf('background-image:linear-gradient(180deg, rgba(0,0,0,0.62)');
    expect(gradientIdx).toBeGreaterThan(-1);
    expect(html.indexOf('WEEKEND_TITLE_MARKER', gradientIdx)).toBeGreaterThan(gradientIdx);
    expect(html).toContain('DJ UM');
    expect(html).toContain('DJ DOIS');
    expect(html).toContain('max-width:168px');
  });

  it('card único (1 evento) continua sem título sobreposto e sem chips — fora de escopo do redesign', () => {
    const event = { ...MOCK_EVENT_DATA, weekendEvents: [gridItem({ title: 'SINGLE_MARKER', lineup: ['DJ SOLO'] })] };
    const blocks: Block[] = [{ id: 'w', kind: 'weekend_grid', layout: 'grid' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    expect(html).toContain('SINGLE_MARKER');
    expect(html).not.toContain('background-image:linear-gradient(180deg, rgba(0,0,0,0.62)');
    expect(html).not.toContain('DJ SOLO');
  });
});
