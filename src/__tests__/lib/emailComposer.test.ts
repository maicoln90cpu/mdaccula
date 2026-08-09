import { describe, expect, it } from 'vitest';
import {
  buildEventAnnouncementData,
  buildMultiEventAnnouncementData,
  composeEmail,
  type EmailEventRow,
} from '@shared/emailComposer.ts';
import type { Block } from '@shared/emailBlocks.ts';

const row: EmailEventRow = {
  id: 'event-1',
  title: 'Krush',
  subtitle: 'Cortesias limitadas',
  slug: 'krush',
  date: '2026-07-17',
  time: '21:00:00',
  venue: 'Casa Aragon',
  location_city: 'Sao Paulo',
  location_state: 'SP',
  image_url: 'https://cdn.example.com/krush.jpg',
  description: 'Uma noite especial.',
  ticket_link: 'https://tickets.example.com/krush',
  vip_link: 'https://wa.me/5511999999999',
  cta_type: 'courtesy',
  lineup: ['BARJA', 'DRE GUAZZELLI'],
  latitude: -23.5,
  longitude: -46.6,
  venue_lat: null,
  venue_lng: null,
};

const article = {
  title: 'Guia do evento',
  excerpt: 'Tudo que voce precisa saber.',
  url: 'https://mdaccula.com/blog/krush',
  image_url: 'https://cdn.example.com/article.jpg',
};

const allKinds: Block[] = [
  { id: 'header', kind: 'header' },
  { id: 'hero', kind: 'hero_image' },
  { id: 'eyebrow', kind: 'eyebrow', text: 'CORTESIA' },
  { id: 'title', kind: 'title' },
  { id: 'subtitle', kind: 'subtitle' },
  { id: 'meta', kind: 'event_meta' },
  { id: 'description', kind: 'description' },
  { id: 'article', kind: 'article_summary' },
  { id: 'cta', kind: 'cta_button', url_field: 'vip_link' },
  { id: 'secondary', kind: 'secondary_link', url_field: 'event_url' },
  {
    id: 'image',
    kind: 'image_with_link',
    image_url: 'https://cdn.example.com/a.jpg',
    link_url: 'https://mdaccula.com',
  },
  { id: 'divider', kind: 'divider' },
  { id: 'text', kind: 'text', html: '<p>Oi</p>' },
  {
    id: 'social',
    kind: 'social_icons',
    networks: [
      { id: 'instagram', label: 'Instagram', url: 'https://instagram.com/mdaccula', enabled: true },
    ],
  },
  { id: 'lineup', kind: 'lineup' },
  { id: 'countdown', kind: 'countdown', deadline_source: 'event_start' },
  { id: 'ticker', kind: 'ticker' },
  { id: 'map', kind: 'static_map' },
  { id: 'weekend', kind: 'weekend_grid' },
  { id: 'dedge', kind: 'dedge_block' },
  { id: 'weekly', kind: 'weekly_hero' },
  { id: 'posts', kind: 'blog_posts_list' },
  { id: 'footer', kind: 'footer' },
];

describe('compositor canonico de e-mail', () => {
  it('converte todos os dados do evento usados pelos blocos', () => {
    const data = buildEventAnnouncementData(row);

    expect(data.lineup).toEqual(['BARJA', 'DRE GUAZZELLI']);
    expect(data.vipLink).toBe(row.vip_link);
    expect(data.eventStartIso).toBe(new Date('2026-07-17T21:00:00').toISOString());
    expect(data.venueLat).toBe(row.latitude);
    expect(data.venueLng).toBe(row.longitude);
  });

  it('deriva ctaLabel do cta_type quando nao-padrao (regressao: botao fixo por URL)', () => {
    const courtesy = buildEventAnnouncementData(row);
    expect(courtesy.ctaLabel).toBe('Emitir Cortesia');

    const defaultType = buildEventAnnouncementData({ ...row, cta_type: 'buy_ticket' });
    expect(defaultType.ctaLabel).toBeUndefined();

    const guestList = buildEventAnnouncementData({ ...row, cta_type: 'guest_list' });
    expect(guestList.ctaLabel).toBe('Enviar Nomes para Lista');
  });

  it('usa venue_lat/venue_lng quando latitude/longitude ainda nao existem', () => {
    const data = buildEventAnnouncementData({
      ...row,
      latitude: null,
      longitude: null,
      venue_lat: -23.55,
      venue_lng: -46.65,
    });

    expect(data.venueLat).toBe(-23.55);
    expect(data.venueLng).toBe(-46.65);
  });

  it('renderiza lineup e link VIP no HTML final', () => {
    const result = composeEmail({
      template: {
        blocks: [
          { id: 'lineup', kind: 'lineup' },
          { id: 'vip', kind: 'cta_button', url_field: 'vip_link', label: 'VIP' },
        ],
        subject_template: '{{event_title}}',
        preheader_template: '{{venue_name}}',
      },
      event: buildEventAnnouncementData(row),
    });

    expect(result.issues).toEqual([]);
    expect(result.html).toContain('BARJA');
    expect(result.html).toContain('DRE GUAZZELLI');
    expect(result.html).toContain('https://wa.me/5511999999999');
  });

  it('valida todos os blocos dependentes de dados e ignora blocos ocultos', () => {
    const event = buildEventAnnouncementData(row);
    event.weekendEvents = [
      {
        id: 'w1',
        title: 'Krush',
        dayLabel: 'sexta',
        timeLabel: '21h',
        venue: 'Casa Aragon',
        cityState: 'Sao Paulo-SP',
        imageUrl: row.image_url!,
        eventUrl: event.eventUrl,
        ticketUrl: event.ticketUrl,
      },
    ];
    event.blogPosts = [{ id: 'p1', title: 'Post', url: article.url }];
    event.dedge = {
      imageUrl: 'https://cdn.example.com/dedge.jpg',
      title: 'Dedge',
      description: 'Programacao',
      nights: [{ label: 'Sex', url: 'https://mdaccula.com', enabled: true }],
    };

    const valid = composeEmail({
      template: { blocks: allKinds, subject_template: '{{event_title}}' },
      event,
      article,
    });
    expect(valid.issues).toEqual([]);

    const invalid = composeEmail({
      template: {
        blocks: [
          { id: 'lu', kind: 'lineup' },
          { id: 'map', kind: 'static_map' },
          { id: 'article', kind: 'article_summary' },
          { id: 'hidden', kind: 'description', hidden: true } as Block,
        ],
        subject_template: 'Assunto',
      },
      event: { ...event, lineup: [], venueLat: undefined, venueLng: undefined, description: '' },
      article: null,
    });

    expect(invalid.issues.map((issue) => issue.blockId)).toEqual(['lu', 'map', 'article']);
  });
});

describe('buildMultiEventAnnouncementData', () => {
  const baseEvent = (overrides: Partial<EmailEventRow> = {}): EmailEventRow => ({
    id: 'evt-1',
    title: 'Evento Base',
    subtitle: null,
    slug: 'evento-base',
    date: '2026-08-23',
    time: '22:00:00',
    venue: 'Clube X',
    location_city: 'São Paulo',
    location_state: 'SP',
    image_url: 'https://cdn.mdaccula.com/evento-base.webp',
    description: null,
    ticket_link: 'https://ingressos.com/evento-base',
    vip_link: null,
    cta_type: null,
    lineup: null,
    latitude: null,
    longitude: null,
    venue_lat: null,
    venue_lng: null,
    pix_button_enabled: null,
    ...overrides,
  });

  it('gera título automático com o nome real do evento quando há só 1 evento', () => {
    const result = buildMultiEventAnnouncementData([baseEvent({ title: 'Krush' })]);
    expect(result.eventTitle).toBe('Krush');
  });

  it('junta os nomes reais dos eventos quando são 2', () => {
    const result = buildMultiEventAnnouncementData([
      baseEvent({ id: 'a', title: 'Krush' }),
      baseEvent({ id: 'b', title: 'Nostalgia' }),
    ]);
    expect(result.eventTitle).toBe('Krush e Nostalgia');
  });

  it('junta os nomes reais dos eventos com vírgula + "e" quando são 3+', () => {
    const result = buildMultiEventAnnouncementData([
      baseEvent({ id: 'a', title: 'Krush' }),
      baseEvent({ id: 'b', title: 'Nostalgia' }),
      baseEvent({ id: 'c', title: 'Bagualhaço' }),
    ]);
    expect(result.eventTitle).toBe('Krush, Nostalgia e Bagualhaço');
  });

  it('cai direto no fallback genérico (sem etapa intermediária) quando os nomes reais juntos passam do limite seguro pro assunto', () => {
    // O assunto é uma linha só (não dá pra virar lista) — quando os nomes não
    // cabem, pula direto pra frase genérica. A lista completa fica só no H1
    // (event.gridEvents), não tenta um resumo tipo "Primeiro e mais N".
    const result = buildMultiEventAnnouncementData([
      baseEvent({ id: 'a', title: 'Evento Extremamente Longo Um' }),
      baseEvent({ id: 'b', title: 'Evento Extremamente Longo Dois' }),
      baseEvent({ id: 'c', title: 'Evento Extremamente Longo Tres' }),
    ]);
    expect(result.eventTitle).toBe('3 eventos com novo lote hoje');
  });

  it('cai no fallback genérico quando um único título já é longo demais pro assunto', () => {
    const result = buildMultiEventAnnouncementData([
      baseEvent({ id: 'a', title: 'Um Título de Evento Absurdamente Longo Que Nunca Caberia Em Um Assunto de E-mail Decente' }),
      baseEvent({ id: 'b', title: 'Outro Evento' }),
    ]);
    expect(result.eventTitle).toBe('2 eventos com novo lote hoje');
  });

  it('titleOverride sobrescreve o título automático (regressão: assunto do e-mail usava {{event_title}} sem respeitar o override do bloco title)', () => {
    const result = buildMultiEventAnnouncementData(
      [baseEvent({ id: 'a' }), baseEvent({ id: 'b' })],
      { titleOverride: 'Promo especial de fim de semana' },
    );
    expect(result.eventTitle).toBe('Promo especial de fim de semana');
  });

  it('titleOverride em branco (só espaços) cai no título automático com os nomes reais', () => {
    const result = buildMultiEventAnnouncementData(
      [baseEvent({ id: 'a', title: 'Krush' }), baseEvent({ id: 'b', title: 'Nostalgia' })],
      { titleOverride: '   ' },
    );
    expect(result.eventTitle).toBe('Krush e Nostalgia');
  });

  it('mapeia cada evento para gridEvents com o shape de WeekendEventItem', () => {
    const result = buildMultiEventAnnouncementData([baseEvent()], { baseUrl: 'https://mdaccula.com' });
    expect(result.gridEvents).toHaveLength(1);
    expect(result.gridEvents?.[0]).toMatchObject({
      id: 'evt-1',
      title: 'Evento Base',
      venue: 'Clube X',
      cityState: 'São Paulo-SP',
      imageUrl: 'https://cdn.mdaccula.com/evento-base.webp',
      eventUrl: 'https://mdaccula.com/eventos/evento-base',
      ticketUrl: 'https://ingressos.com/evento-base',
    });
  });

  it('usa a URL do evento como ticketUrl quando ticket_link está vazio', () => {
    const result = buildMultiEventAnnouncementData([baseEvent({ ticket_link: null })], { baseUrl: 'https://mdaccula.com' });
    expect(result.gridEvents?.[0].ticketUrl).toBe('https://mdaccula.com/eventos/evento-base');
  });

  it('preenche ctaLabel só quando cta_type é diferente do padrão', () => {
    const result = buildMultiEventAnnouncementData([
      baseEvent({ cta_type: 'buy_ticket_discount' }),
    ]);
    expect(result.gridEvents?.[0].ctaLabel).toBe('Comprar Ingresso com Desconto');
  });

  it('propaga o lineup do evento para gridEvents, removendo vazios e espaços', () => {
    const result = buildMultiEventAnnouncementData([
      baseEvent({ lineup: ['BARJA', '  DRE GUAZZELLI  ', '', '   '] }),
    ]);
    expect(result.gridEvents?.[0].lineup).toEqual(['BARJA', 'DRE GUAZZELLI']);
  });

  it('gridEvents tem lineup vazio quando o evento não tem line-up cadastrado', () => {
    const result = buildMultiEventAnnouncementData([baseEvent({ lineup: null })]);
    expect(result.gridEvents?.[0].lineup).toEqual([]);
  });
});
