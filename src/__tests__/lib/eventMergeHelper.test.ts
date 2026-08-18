import { describe, it, expect } from 'vitest';
import {
  hasDistinctTicketLinks,
  buildMergeShellPayload,
  type MergeableEventRow,
} from '@/lib/eventMergeHelper';

function makeEvent(overrides: Partial<MergeableEventRow>): MergeableEventRow {
  return {
    id: 'id',
    title: 'Título',
    subtitle: null,
    venue: 'Venue',
    address: 'Endereço',
    location_state: 'SP',
    location_city: 'São Paulo',
    date: '2026-12-28',
    end_date: null,
    time: '16:00',
    end_time: null,
    genres: ['House'],
    lineup: ['Artista'],
    description: 'Descrição',
    ticket_link: 'https://exemplo.com/ingresso',
    vip_link: null,
    pix_button_enabled: false,
    cta_type: 'buy_ticket',
    image_url: 'https://exemplo.com/imagem.webp',
    views: 10,
    ...overrides,
  };
}

describe('hasDistinctTicketLinks', () => {
  it('retorna false quando todos os eventos têm o mesmo link', () => {
    const events = [
      makeEvent({ id: 'a', ticket_link: 'https://x.com/1' }),
      makeEvent({ id: 'b', ticket_link: 'https://x.com/1' }),
    ];
    expect(hasDistinctTicketLinks(events)).toBe(false);
  });

  it('retorna true quando os links divergem', () => {
    const events = [
      makeEvent({ id: 'a', ticket_link: 'https://x.com/1' }),
      makeEvent({ id: 'b', ticket_link: 'https://x.com/2' }),
    ];
    expect(hasDistinctTicketLinks(events)).toBe(true);
  });
});

describe('buildMergeShellPayload', () => {
  it('não muta nenhum dos eventos recebidos', () => {
    const events = [
      Object.freeze(makeEvent({ id: 'a', date: '2026-12-28' })),
      Object.freeze(makeEvent({ id: 'b', date: '2026-12-29' })),
    ];
    expect(() =>
      buildMergeShellPayload(events, 'a', {
        title: 'Festival X',
        imageUrl: 'https://exemplo.com/nova.webp',
        ticketsPerDay: true,
      })
    ).not.toThrow();
  });

  it('calcula intervalo de datas, soma views e monta schedule com todos os dias', () => {
    const events = [
      makeEvent({ id: 'a', date: '2026-12-29', end_date: null, views: 5, lineup: ['B'] }),
      makeEvent({ id: 'b', date: '2026-12-28', end_date: null, views: 3, lineup: ['A'] }),
      makeEvent({ id: 'c', date: '2026-12-31', end_date: null, views: 2, lineup: ['C'] }),
    ];
    const payload = buildMergeShellPayload(events, 'b', {
      title: 'Festival X',
      imageUrl: 'https://exemplo.com/nova.webp',
      ticketsPerDay: true,
    });

    expect(payload.date).toBe('2026-12-28');
    expect(payload.end_date).toBe('2026-12-31');
    expect(payload.views).toBe(10);
    expect(payload.schedule).toEqual([
      { date: '2026-12-28', time: '16:00', end_time: null, lineup: ['A'] },
      { date: '2026-12-29', time: '16:00', end_time: null, lineup: ['B'] },
      { date: '2026-12-31', time: '16:00', end_time: null, lineup: ['C'] },
    ]);
  });

  it('copia venue/endereço/gêneros/etc. do evento "seed" (não do primeiro por data)', () => {
    const events = [
      makeEvent({ id: 'a', date: '2026-12-29', venue: 'Venue A', genres: ['Techno'] }),
      makeEvent({ id: 'b', date: '2026-12-28', venue: 'Venue B', genres: ['House'] }),
    ];
    const payload = buildMergeShellPayload(events, 'a', {
      title: 'Festival X',
      imageUrl: null,
      ticketsPerDay: false,
    });
    expect(payload.venue).toBe('Venue A');
    expect(payload.genres).toEqual(['Techno']);
  });

  it('quando ticketsPerDay=false, copia o ticket_link do seed; quando true, fica null', () => {
    const events = [
      makeEvent({ id: 'a', ticket_link: 'https://x.com/unico' }),
      makeEvent({ id: 'b', ticket_link: 'https://x.com/unico' }),
    ];
    const single = buildMergeShellPayload(events, 'a', {
      title: 'F',
      imageUrl: null,
      ticketsPerDay: false,
    });
    expect(single.ticket_link).toBe('https://x.com/unico');

    const perDay = buildMergeShellPayload(events, 'a', {
      title: 'F',
      imageUrl: null,
      ticketsPerDay: true,
    });
    expect(perDay.ticket_link).toBeNull();
  });

  it('sempre nasce sem artigo vinculado e como card-vitrine ativo', () => {
    const events = [makeEvent({ id: 'a' }), makeEvent({ id: 'b' })];
    const payload = buildMergeShellPayload(events, 'a', {
      title: 'F',
      imageUrl: null,
      ticketsPerDay: true,
    });
    expect(payload.blog_post_id).toBeNull();
    expect(payload.status).toBe('active');
    expect(payload.is_merge_shell).toBe(true);
  });

  it('lança erro claro se o seedId não estiver entre os eventos', () => {
    const events = [makeEvent({ id: 'a' })];
    expect(() =>
      buildMergeShellPayload(events, 'inexistente', {
        title: 'F',
        imageUrl: null,
        ticketsPerDay: false,
      })
    ).toThrow(/base não encontrado/i);
  });
});
