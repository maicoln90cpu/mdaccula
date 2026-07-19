import { describe, it, expect } from 'vitest';
import { processLinks } from '@/hooks/useLinks';
import type { RawLinkData } from '@/types';

/**
 * Bug reproduzido: evento Nostalgia com date=2026-07-09, end_date=2026-07-10.
 * Custom_links por dia usam override_date. Antes: event.date ganhava do override
 * e o link do dia 10 ficava oculto no dia 10. Depois: override manda.
 */

const baseLink = (over: Partial<RawLinkData>): RawLinkData => ({
  id: 'l1',
  title: 't',
  url: '#',
  thumbnail_url: null,
  icon: 'link',
  color_gradient: null,
  clicks: 0,
  enabled: true,
  is_internal: false,
  display_order: 0,
  ...over,
});

const FIXED_NOW = new Date('2026-07-10T13:00:00-03:00').getTime();

describe('processLinks — override_date x event.date', () => {
  const origNow = Date.now;
  beforeAll(() => {
    Date.now = () => FIXED_NOW;
  });
  afterAll(() => {
    Date.now = origNow;
  });

  it('override_date futuro prevalece sobre event.date passada (Nostalgia dia 2)', () => {
    const link = baseLink({
      override_date: '2026-07-10',
      override_time: '20:00',
      events: {
        venue: 'x',
        location_city: 'x',
        location_state: 'x',
        date: '2026-07-09',
        end_date: '2026-07-10',
        time: '20:00',
      },
    });
    const result = processLinks([link]);
    expect(result).toHaveLength(1);
  });

  it('override_date passada oculta o link mesmo com event.end_date futura', () => {
    const link = baseLink({
      override_date: '2026-07-09',
      override_time: '20:00',
      events: {
        venue: 'x',
        location_city: 'x',
        location_state: 'x',
        date: '2026-07-09',
        end_date: '2026-07-10',
        time: '20:00',
      },
    });
    const result = processLinks([link]);
    // 09/07 20h + 12h grace = 10/07 08h → às 13h já expirou
    expect(result).toHaveLength(0);
  });

  it('sem override, event multi-dia com end_date futura mantém visível', () => {
    const link = baseLink({
      events: {
        venue: 'x',
        location_city: 'x',
        location_state: 'x',
        date: '2026-07-09',
        end_date: '2026-07-10',
        time: '20:00',
      },
    });
    const result = processLinks([link]);
    expect(result).toHaveLength(1);
  });

  it('sem override e sem end_date, event passado é ocultado', () => {
    const link = baseLink({
      events: {
        venue: 'x',
        location_city: 'x',
        location_state: 'x',
        date: '2026-07-08',
        time: '20:00',
      },
    });
    const result = processLinks([link]);
    expect(result).toHaveLength(0);
  });
});
