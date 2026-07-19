import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sortByEventDate,
  sortLinksHybrid,
  isLinkForFutureEvent,
  processLinksForDisplay,
} from '@/lib/linkSortHelper';

interface TestLink {
  id: string;
  display_order: number;
  override_date?: string | null;
  override_time?: string | null;
  manual_order_override?: boolean;
  enabled: boolean;
  events?: {
    date: string;
    time: string;
  } | null;
}

describe('linkSortHelper', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-06T15:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('sortByEventDate', () => {
    it('should sort by display_order when manual_order_override is true', () => {
      const links: TestLink[] = [
        { id: '1', display_order: 3, manual_order_override: true, enabled: true },
        { id: '2', display_order: 1, manual_order_override: true, enabled: true },
        { id: '3', display_order: 2, manual_order_override: true, enabled: true },
      ];

      const sorted = [...links].sort(sortByEventDate);
      expect(sorted.map((l) => l.id)).toEqual(['2', '3', '1']);
    });

    it('should sort by event date when no manual override', () => {
      const links: TestLink[] = [
        { id: '1', display_order: 1, enabled: true, events: { date: '2026-01-10', time: '22:00' } },
        { id: '2', display_order: 2, enabled: true, events: { date: '2026-01-08', time: '22:00' } },
        { id: '3', display_order: 3, enabled: true, events: { date: '2026-01-09', time: '22:00' } },
      ];

      const sorted = [...links].sort(sortByEventDate);
      expect(sorted.map((l) => l.id)).toEqual(['2', '3', '1']);
    });

    it('should use override_date over event date', () => {
      const links: TestLink[] = [
        {
          id: '1',
          display_order: 1,
          enabled: true,
          override_date: '2026-01-07',
          events: { date: '2026-01-15', time: '22:00' },
        },
        { id: '2', display_order: 2, enabled: true, events: { date: '2026-01-08', time: '22:00' } },
      ];

      const sorted = [...links].sort(sortByEventDate);
      expect(sorted.map((l) => l.id)).toEqual(['1', '2']);
    });

    it('should use display_order as tiebreaker for same date/time', () => {
      const links: TestLink[] = [
        { id: '1', display_order: 3, enabled: true, events: { date: '2026-01-10', time: '22:00' } },
        { id: '2', display_order: 1, enabled: true, events: { date: '2026-01-10', time: '22:00' } },
        { id: '3', display_order: 2, enabled: true, events: { date: '2026-01-10', time: '22:00' } },
      ];

      const sorted = [...links].sort(sortByEventDate);
      expect(sorted.map((l) => l.id)).toEqual(['2', '3', '1']);
    });

    it('should handle links without events (placed at end)', () => {
      const links: TestLink[] = [
        { id: '1', display_order: 1, enabled: true },
        { id: '2', display_order: 2, enabled: true, events: { date: '2026-01-08', time: '22:00' } },
      ];

      const sorted = [...links].sort(sortByEventDate);
      expect(sorted.map((l) => l.id)).toEqual(['2', '1']);
    });

    it('should respect manual override position among automatic links (via sortLinksHybrid)', () => {
      const links: TestLink[] = [
        { id: '1', display_order: 2, manual_order_override: true, enabled: true },
        { id: '2', display_order: 1, enabled: true, events: { date: '2026-01-10', time: '22:00' } },
        { id: '3', display_order: 3, enabled: true, events: { date: '2026-01-08', time: '22:00' } },
      ];

      // automatic sorted by date: ['3','2']; insert manual '1' at position 2 (end)
      const sorted = sortLinksHybrid(links);
      expect(sorted.map((l) => l.id)).toEqual(['3', '2', '1']);
    });
  });

  describe('sortLinksHybrid', () => {
    it('should interleave multiple manual links between automatic ones', () => {
      const links: TestLink[] = [
        { id: 'a', display_order: 0, enabled: true, events: { date: '2026-01-08', time: '22:00' } },
        { id: 'b', display_order: 0, enabled: true, events: { date: '2026-01-10', time: '22:00' } },
        { id: 'c', display_order: 0, enabled: true, events: { date: '2026-01-12', time: '22:00' } },
        { id: 'm1', display_order: 1, manual_order_override: true, enabled: true },
        { id: 'm2', display_order: 3, manual_order_override: true, enabled: true },
      ];
      // automatic: [a,b,c]; insert m1 at 1 -> [a,m1,b,c]; insert m2 at 3 -> [a,m1,b,m2,c]
      const sorted = sortLinksHybrid(links);
      expect(sorted.map((l) => l.id)).toEqual(['a', 'm1', 'b', 'm2', 'c']);
    });

    it('should clamp manual display_order beyond list length to the end', () => {
      const links: TestLink[] = [
        { id: 'a', display_order: 0, enabled: true, events: { date: '2026-01-08', time: '22:00' } },
        { id: 'm', display_order: 99, manual_order_override: true, enabled: true },
      ];
      const sorted = sortLinksHybrid(links);
      expect(sorted.map((l) => l.id)).toEqual(['a', 'm']);
    });

    it('should sort all-manual links by display_order', () => {
      const links: TestLink[] = [
        { id: '1', display_order: 2, manual_order_override: true, enabled: true },
        { id: '2', display_order: 0, manual_order_override: true, enabled: true },
        { id: '3', display_order: 1, manual_order_override: true, enabled: true },
      ];
      const sorted = sortLinksHybrid(links);
      expect(sorted.map((l) => l.id)).toEqual(['2', '3', '1']);
    });
  });

  describe('isLinkForFutureEvent', () => {
    it('should return true for links without dates', () => {
      const link: TestLink = { id: '1', display_order: 1, enabled: true };
      expect(isLinkForFutureEvent(link, '2026-01-06')).toBe(true);
    });

    it('should return true for future events', () => {
      const link: TestLink = {
        id: '1',
        display_order: 1,
        enabled: true,
        events: { date: '2026-01-10', time: '22:00' },
      };
      expect(isLinkForFutureEvent(link, '2026-01-06')).toBe(true);
    });

    it('should return true for events today', () => {
      const link: TestLink = {
        id: '1',
        display_order: 1,
        enabled: true,
        events: { date: '2026-01-06', time: '22:00' },
      };
      expect(isLinkForFutureEvent(link, '2026-01-06')).toBe(true);
    });

    it('should return false for past events', () => {
      const link: TestLink = {
        id: '1',
        display_order: 1,
        enabled: true,
        events: { date: '2026-01-01', time: '22:00' },
      };
      expect(isLinkForFutureEvent(link, '2026-01-06')).toBe(false);
    });

    it('should use override_date over event date', () => {
      const link: TestLink = {
        id: '1',
        display_order: 1,
        enabled: true,
        override_date: '2026-01-10',
        events: { date: '2026-01-01', time: '22:00' },
      };
      expect(isLinkForFutureEvent(link, '2026-01-06')).toBe(true);
    });
  });

  describe('processLinksForDisplay', () => {
    it('should filter disabled links', () => {
      const links: TestLink[] = [
        {
          id: '1',
          display_order: 1,
          enabled: false,
          events: { date: '2026-01-10', time: '22:00' },
        },
        { id: '2', display_order: 2, enabled: true, events: { date: '2026-01-10', time: '22:00' } },
      ];

      const processed = processLinksForDisplay(links);
      expect(processed).toHaveLength(1);
      expect(processed[0].id).toBe('2');
    });

    it('should filter past events', () => {
      const links: TestLink[] = [
        { id: '1', display_order: 1, enabled: true, events: { date: '2026-01-01', time: '22:00' } },
        { id: '2', display_order: 2, enabled: true, events: { date: '2026-01-10', time: '22:00' } },
      ];

      const processed = processLinksForDisplay(links);
      expect(processed).toHaveLength(1);
      expect(processed[0].id).toBe('2');
    });

    it('should sort remaining links by event date', () => {
      const links: TestLink[] = [
        { id: '1', display_order: 1, enabled: true, events: { date: '2026-01-15', time: '22:00' } },
        { id: '2', display_order: 2, enabled: true, events: { date: '2026-01-10', time: '22:00' } },
        { id: '3', display_order: 3, enabled: true, events: { date: '2026-01-12', time: '22:00' } },
      ];

      const processed = processLinksForDisplay(links);
      expect(processed.map((l) => l.id)).toEqual(['2', '3', '1']);
    });

    it('should handle empty array', () => {
      expect(processLinksForDisplay([])).toEqual([]);
    });

    it('should preserve all link properties', () => {
      interface ExtendedLink extends TestLink {
        title: string;
        url: string;
      }

      const links: ExtendedLink[] = [
        {
          id: '1',
          title: 'Test Link',
          url: 'https://example.com',
          display_order: 1,
          enabled: true,
          events: { date: '2026-01-10', time: '22:00' },
        },
      ];

      const processed = processLinksForDisplay(links);
      expect(processed[0].title).toBe('Test Link');
      expect(processed[0].url).toBe('https://example.com');
    });
  });
});
