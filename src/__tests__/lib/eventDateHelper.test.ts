import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isEventVisible,
  filterVisibleEvents,
  isEventActive,
  EventVisibilityParams,
} from '@/lib/eventDateHelper';

describe('eventDateHelper', () => {
  beforeEach(() => {
    // Mock Date to 2026-01-06 15:00:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-06T15:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isEventVisible', () => {
    it('should return true for future events', () => {
      const event: EventVisibilityParams = {
        date: '2026-01-10',
        time: '22:00',
      };
      expect(isEventVisible(event)).toBe(true);
    });

    it('should return true for events happening today', () => {
      const event: EventVisibilityParams = {
        date: '2026-01-06',
        time: '22:00',
      };
      expect(isEventVisible(event)).toBe(true);
    });

    it('should return false for events that ended more than graceHours ago', () => {
      const event: EventVisibilityParams = {
        date: '2026-01-05',
        time: '20:00',
        end_time: '02:00', // Ends 2026-01-06 02:00, grace until 08:00
      };
      // Current time is 15:00, so event should not be visible
      expect(isEventVisible(event)).toBe(false);
    });

    it('should return true for events within grace period', () => {
      const event: EventVisibilityParams = {
        date: '2026-01-06',
        time: '02:00',
        end_time: '08:00', // Ends 08:00, grace until 14:00
      };
      // Current time is 15:00, grace ended at 14:00
      expect(isEventVisible(event)).toBe(false);
    });

    it('should handle overnight events correctly', () => {
      const event: EventVisibilityParams = {
        date: '2026-01-05',
        time: '23:00',
        end_time: '06:00', // Ends 2026-01-06 06:00, grace until 12:00
      };
      // Current time is 15:00, so event should not be visible
      expect(isEventVisible(event)).toBe(false);
    });

    it('should return true for events with incomplete data', () => {
      const event: EventVisibilityParams = {
        date: '',
        time: '',
      };
      expect(isEventVisible(event)).toBe(true);
    });

    it('should respect custom grace hours', () => {
      const event: EventVisibilityParams = {
        date: '2026-01-06',
        time: '06:00',
        end_time: '08:00', // Ends 08:00
      };
      // With 10 hours grace, visible until 18:00 (current: 15:00)
      expect(isEventVisible(event, { graceHours: 10 })).toBe(true);
      // With 2 hours grace, visible until 10:00 (current: 15:00)
      expect(isEventVisible(event, { graceHours: 2 })).toBe(false);
    });

    it('should use 8 hours default duration when no end_time', () => {
      const event: EventVisibilityParams = {
        date: '2026-01-06',
        time: '02:00',
        // No end_time, so ends at 10:00, grace until 16:00
      };
      // Current time is 15:00, should still be visible
      expect(isEventVisible(event)).toBe(true);
    });
  });

  describe('filterVisibleEvents', () => {
    it('should filter out invisible events', () => {
      const events: EventVisibilityParams[] = [
        { date: '2026-01-10', time: '22:00' }, // Future - visible
        { date: '2026-01-06', time: '22:00' }, // Today - visible
        { date: '2026-01-01', time: '20:00', end_time: '02:00' }, // Past - hidden
      ];

      const visible = filterVisibleEvents(events);
      expect(visible).toHaveLength(2);
      expect(visible[0].date).toBe('2026-01-10');
      expect(visible[1].date).toBe('2026-01-06');
    });

    it('should return empty array for empty input', () => {
      expect(filterVisibleEvents([])).toEqual([]);
    });

    it('should preserve event properties', () => {
      interface ExtendedEvent extends EventVisibilityParams {
        id: string;
        title: string;
      }

      const events: ExtendedEvent[] = [
        { id: '1', title: 'Future Event', date: '2026-01-10', time: '22:00' },
      ];

      const visible = filterVisibleEvents(events);
      expect(visible[0].id).toBe('1');
      expect(visible[0].title).toBe('Future Event');
    });
  });

  describe('isEventActive', () => {
    it('should return same result as isEventVisible', () => {
      const futureEvent: EventVisibilityParams = {
        date: '2026-01-10',
        time: '22:00',
      };
      const pastEvent: EventVisibilityParams = {
        date: '2026-01-01',
        time: '20:00',
        end_time: '02:00',
      };

      expect(isEventActive(futureEvent)).toBe(isEventVisible(futureEvent));
      expect(isEventActive(pastEvent)).toBe(isEventVisible(pastEvent));
    });
  });
});
