/**
 * Regressão R-080 — Card do grid de eventos (`event_grid` / `weekend_grid`
 * layout "grid") saía perfeito no Gmail mas quebrado no Outlook, com a
 * imagem antes do nome do evento (pedido era o contrário) e com o controle
 * de Alinhamento do bloco só afetando o cabeçalho, nunca o card em si.
 *
 * Bug original (reportado 20/08/2026, com screenshots):
 *   1. Botões dos cards do grid, do `dedge_block` e do `weekly_hero` eram
 *      `<a style="background:...">` simples — Outlook (motor Word) ignora
 *      `background`/`border-radius` em `<a>`, então o botão saía sem cor
 *      nenhuma. A técnica VML "bulletproof button" já existia em
 *      `cta_button`/`pix_button` mas não tinha sido aplicada nesses outros
 *      botões.
 *   2. Chips de line-up dentro do card do grid usavam `.join("")` — Outlook
 *      ignora `display:inline-block`/margin em e-mail, então os nomes dos
 *      artistas saíam colados uns nos outros (mesmo bug já corrigido no
 *      bloco avulso `lineup`, nunca replicado aqui).
 *   3. Dentro de `renderGridEventCard`, a imagem vinha antes do nome.
 *   4. `align` do bloco só era aplicado ao `<td>` do cabeçalho (etiqueta/
 *      título) — nunca propagado para dentro de cada card, então escolher
 *      "Centro" não centralizava imagem/nome/dia-local/line-up do card.
 *
 * Correção:
 *   - `renderBulletproofButton` (utils.ts) extrai a técnica VML já usada em
 *     `cta_button`/`pix_button` e passa a ser reutilizada por todos os
 *     botões de `digest.ts` (grid card, weekend_grid nos 3 layouts,
 *     dedge_block, weekly_hero).
 *   - Chips do card do grid passam a usar `.join(" ")`.
 *   - `renderGridEventCard` inverte a ordem: nome primeiro, imagem depois.
 *   - `renderGridEventCard` recebe `align` e aplica `text-align` nos 3
 *     `<td>` internos do card (nome, imagem, dia/local + line-up + botão).
 */
import { describe, it, expect } from 'vitest';
import { renderBlockedTemplate, type Block } from '@/lib/emailTemplates/blocks';
import { MOCK_EVENT_DATA } from '@/lib/emailTemplates/eventAnnouncement';

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

describe('R-080 — grid card: nome vem antes da imagem', () => {
  it('event_grid: a faixa com o nome do evento aparece antes da tag <img> no HTML', () => {
    const event = { ...MOCK_EVENT_DATA, gridEvents: [gridItem({ title: 'ORDER_MARKER_TITLE' })] };
    const blocks: Block[] = [{ id: 'g', kind: 'event_grid' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    const titleIdx = html.indexOf('ORDER_MARKER_TITLE');
    const imgIdx = html.indexOf('<img', titleIdx);
    expect(titleIdx).toBeGreaterThan(-1);
    expect(imgIdx).toBeGreaterThan(titleIdx);
  });

  it('weekend_grid layout grid (2+ eventos) também aplica a nova ordem no card compartilhado', () => {
    const event = {
      ...MOCK_EVENT_DATA,
      weekendEvents: [
        gridItem({ id: 'w1', title: 'WEEKEND_ORDER_MARKER' }),
        gridItem({ id: 'w2' }),
      ],
    };
    const blocks: Block[] = [{ id: 'w', kind: 'weekend_grid', layout: 'grid' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    const titleIdx = html.indexOf('WEEKEND_ORDER_MARKER');
    const imgIdx = html.indexOf('<img', titleIdx);
    expect(titleIdx).toBeGreaterThan(-1);
    expect(imgIdx).toBeGreaterThan(titleIdx);
  });
});

describe('R-080 — grid card: espaçamento correto entre chips de line-up (compat. Outlook)', () => {
  it('junta os nomes dos artistas com espaço real, não colados', () => {
    const event = {
      ...MOCK_EVENT_DATA,
      gridEvents: [gridItem({ lineup: ['DJ ALPHA', 'DJ BETA'] })],
    };
    const blocks: Block[] = [{ id: 'g', kind: 'event_grid' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    expect(html).toContain('</span> <span');
    expect(html).not.toContain('</span><span');
  });
});

describe('R-080 — grid card: alinhamento do bloco vale para todo o conteúdo do card', () => {
  it('align "center" aplica text-align:center nos 3 <td> internos do card (nome, imagem, dia/local)', () => {
    const event = { ...MOCK_EVENT_DATA, gridEvents: [gridItem()] };
    const blocks: Block[] = [{ id: 'g', kind: 'event_grid', align: 'center' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    expect((html.match(/text-align:center/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it('align "right" aplica text-align:right dentro do card (não fica preso em "left")', () => {
    const event = { ...MOCK_EVENT_DATA, gridEvents: [gridItem()] };
    const blocks: Block[] = [{ id: 'g', kind: 'event_grid', align: 'right' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    expect((html.match(/text-align:right/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it('sem align definido, mantém compatibilidade com templates salvos (comportamento left)', () => {
    const event = { ...MOCK_EVENT_DATA, gridEvents: [gridItem()] };
    const blocks: Block[] = [{ id: 'g', kind: 'event_grid' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    expect((html.match(/text-align:left/g) || []).length).toBeGreaterThanOrEqual(3);
  });
});

describe('Pendência R-080 — alinhamento estendido para weekend_grid "timeline"/"cartaz"/"grid" (1 evento)', () => {
  it('layout "timeline": align "center" aplica text-align:center no cabeçalho e no <td> de conteúdo do card', () => {
    const event = { ...MOCK_EVENT_DATA, weekendEvents: [gridItem()] };
    const blocks: Block[] = [{ id: 'w', kind: 'weekend_grid', layout: 'timeline', align: 'center' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    expect((html.match(/text-align:center/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('layout "timeline": align "right" não fica preso em left', () => {
    const event = { ...MOCK_EVENT_DATA, weekendEvents: [gridItem()] };
    const blocks: Block[] = [{ id: 'w', kind: 'weekend_grid', layout: 'timeline', align: 'right' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    expect((html.match(/text-align:right/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('layout "grid" com 1 evento só: align "center" aplica no cabeçalho e no <td> do corpo do card', () => {
    const event = { ...MOCK_EVENT_DATA, weekendEvents: [gridItem()] };
    const blocks: Block[] = [{ id: 'w', kind: 'weekend_grid', layout: 'grid', align: 'center' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    expect((html.match(/text-align:center/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('layout "cartaz" com 2 eventos: align "center" aplica no cabeçalho e no <td> do corpo de cada card', () => {
    const event = {
      ...MOCK_EVENT_DATA,
      weekendEvents: [gridItem({ id: 'c1' }), gridItem({ id: 'c2' })],
    };
    const blocks: Block[] = [{ id: 'w', kind: 'weekend_grid', layout: 'cartaz', align: 'center' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    expect((html.match(/text-align:center/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it('layout "cartaz": align "right" não fica preso em left', () => {
    const event = { ...MOCK_EVENT_DATA, weekendEvents: [gridItem()] };
    const blocks: Block[] = [{ id: 'w', kind: 'weekend_grid', layout: 'cartaz', align: 'right' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    expect((html.match(/text-align:right/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});

describe('R-080 — botões do grid/dedge/hero ganham o fallback VML do Outlook', () => {
  it('botão de ingresso do card do grid tem o par VML + HTML (bulletproof button)', () => {
    const event = { ...MOCK_EVENT_DATA, gridEvents: [gridItem()] };
    const blocks: Block[] = [{ id: 'g', kind: 'event_grid' }];
    const html = renderBlockedTemplate(blocks, event, null, null, { preview: true });

    expect(html).toContain('<!--[if mso]>');
    expect(html).toContain('v:roundrect');
    expect(html).toContain('<!--[if !mso]><!-- -->');
  });

  it('botões das noites e o botão principal do dedge_block usam o fallback VML', () => {
    const blocks: Block[] = [{ id: 'd', kind: 'dedge_block' }];
    const html = renderBlockedTemplate(blocks, MOCK_EVENT_DATA, null, null, { preview: true });

    const vmlCount = (html.match(/v:roundrect/g) || []).length;
    // 3 noites + 1 botão principal = 4 botões bulletproof
    expect(vmlCount).toBeGreaterThanOrEqual(4);
  });

  it('botão de CTA do weekly_hero usa o fallback VML', () => {
    const blocks: Block[] = [{ id: 'h', kind: 'weekly_hero', source: 'main_event' }];
    const html = renderBlockedTemplate(blocks, MOCK_EVENT_DATA, null, null, { preview: true });

    expect(html).toContain('v:roundrect');
  });
});
