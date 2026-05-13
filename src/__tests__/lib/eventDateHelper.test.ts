import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isEventVisible,
  filterVisibleEvents,
  isEventActive,
  EventVisibilityParams,
} from '@/lib/eventDateHelper';

// "Agora" fixo: 2026-01-06 15:00 BRT (-3) === 2026-01-06 18:00 UTC
const NOW_UTC = new Date('2026-01-06T18:00:00Z');
const TZ = { timezoneOffset: -3 };

describe('eventDateHelper', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW_UTC);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isEventActive (com horário definido)', () => {
    it('é ativo para evento futuro', () => {
      const e: EventVisibilityParams = { date: '2026-01-10', time: '22:00' };
      expect(isEventActive(e, TZ)).toBe(true);
    });

    it('é ativo enquanto está dentro de hoursAfterStart', () => {
      // Evento começou hoje 10:00 BRT, agora 15:00 BRT, default 12h => até 22:00 BRT
      const e: EventVisibilityParams = { date: '2026-01-06', time: '10:00' };
      expect(isEventActive(e, TZ)).toBe(true);
    });

    it('é inativo após hoursAfterStart', () => {
      // Evento começou ontem 20:00 BRT, +12h = hoje 08:00 BRT, agora 15:00 BRT
      const e: EventVisibilityParams = { date: '2026-01-05', time: '20:00' };
      expect(isEventActive(e, TZ)).toBe(false);
    });

    it('respeita hoursAfterStart customizado', () => {
      // Evento ontem 20:00 BRT + 24h = hoje 20:00 BRT, agora 15:00 BRT => ainda ativo
      const e: EventVisibilityParams = { date: '2026-01-05', time: '20:00' };
      expect(isEventActive(e, { ...TZ, hoursAfterStart: 24 })).toBe(true);
    });

    it('ignora end_time mesmo quando informado', () => {
      const e: EventVisibilityParams = {
        date: '2026-01-05',
        time: '20:00',
        end_time: '23:59', // não deve influenciar
      };
      expect(isEventActive(e, TZ)).toBe(false);
    });
  });

  describe('isEventActive (sem horário definido)', () => {
    it('é ativo no dia do evento sem horário (default 24h a partir de 00:00)', () => {
      // Evento hoje 00:00 BRT + 24h = amanhã 00:00 BRT, agora 15:00 BRT
      const e: EventVisibilityParams = { date: '2026-01-06' };
      expect(isEventActive(e, TZ)).toBe(true);
    });

    it('é inativo no dia seguinte', () => {
      const e: EventVisibilityParams = { date: '2026-01-05' };
      expect(isEventActive(e, TZ)).toBe(false);
    });

    it('respeita hoursWithoutTime customizado', () => {
      // Evento ontem + 48h = amanhã 00:00 BRT, agora dentro
      const e: EventVisibilityParams = { date: '2026-01-05' };
      expect(isEventActive(e, { ...TZ, hoursWithoutTime: 48 })).toBe(true);
    });
  });

  describe('timezone', () => {
    it('aplica corretamente o offset', () => {
      // Evento 2026-01-06 16:00 UTC+0 (offset 0) + 12h = 2026-01-07 04:00 UTC
      // agora = 2026-01-06 18:00 UTC => ainda ativo
      const e: EventVisibilityParams = { date: '2026-01-06', time: '16:00' };
      expect(isEventActive(e, { timezoneOffset: 0 })).toBe(true);
    });
  });

  describe('dados incompletos', () => {
    it('retorna true se sem date', () => {
      expect(isEventActive({ date: '' } as EventVisibilityParams, TZ)).toBe(true);
    });
  });

  describe('alias isEventVisible', () => {
    it('comporta-se como isEventActive', () => {
      const e: EventVisibilityParams = { date: '2026-01-10', time: '22:00' };
      expect(isEventVisible(e, TZ)).toBe(isEventActive(e, TZ));
    });
  });

  describe('filterVisibleEvents', () => {
    it('filtra apenas os ativos', () => {
      const events: EventVisibilityParams[] = [
        { date: '2026-01-10', time: '22:00' },
        { date: '2026-01-06', time: '10:00' },
        { date: '2026-01-01', time: '20:00' },
      ];
      const visible = filterVisibleEvents(events, TZ);
      expect(visible).toHaveLength(2);
      expect(visible.map((e) => e.date)).toEqual(['2026-01-10', '2026-01-06']);
    });

    it('retorna array vazio para input vazio', () => {
      expect(filterVisibleEvents([])).toEqual([]);
    });

    it('preserva propriedades extras', () => {
      interface Ext extends EventVisibilityParams {
        id: string;
      }
      const events: Ext[] = [{ id: '1', date: '2026-01-10', time: '22:00' }];
      expect(filterVisibleEvents(events, TZ)[0].id).toBe('1');
    });
  });

  describe('festivais multi-dias (end_date)', () => {
    it('continua ativo enquanto end_date está no futuro, mesmo que date já tenha passado', () => {
      const e: EventVisibilityParams = {
        date: '2026-01-05',
        end_date: '2026-01-07',
        time: '22:00',
      };
      expect(isEventActive(e, TZ)).toBe(true);
    });

    it('fica inativo após end_date + janela de graça (com horário)', () => {
      // end_date 04/01 22:00 BRT + 12h = 05/01 10:00 BRT (passado em 06/01 15:00)
      const e: EventVisibilityParams = {
        date: '2026-01-03',
        end_date: '2026-01-04',
        time: '22:00',
      };
      expect(isEventActive(e, TZ)).toBe(false);
    });

    it('end_date NULL/ausente preserva comportamento de evento de 1 dia', () => {
      const e: EventVisibilityParams = { date: '2026-01-10', time: '22:00', end_date: null };
      expect(isEventActive(e, TZ)).toBe(true);
    });

    it('ignora end_date inválido (anterior a date) e usa date como referência', () => {
      const e: EventVisibilityParams = {
        date: '2026-01-10',
        end_date: '2026-01-08',
        time: '22:00',
      };
      expect(isEventActive(e, TZ)).toBe(true);
    });
  });
});
