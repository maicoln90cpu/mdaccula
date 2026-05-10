/**
 * Helper for sorting and filtering links by event date.
 *
 * Strategy: two-pass hybrid algorithm.
 *  1. Split links into "automatic" (sorted by event date) and "manual"
 *     (links with manual_order_override, sorted by display_order).
 *  2. Insert each manual link into its target display_order position
 *     among the automatic list. Result is stable and deterministic.
 */

interface SortableLink {
  display_order: number;
  override_date?: string | null;
  override_time?: string | null;
  manual_order_override?: boolean;
  events?: {
    date: string;
    time: string;
  } | null;
}

const getDateTimeKey = (link: SortableLink): string => {
  const date = link.override_date || link.events?.date || '9999-12-31';
  const time = link.override_time || link.events?.time || '23:59';
  return `${date}T${time}`;
};

/**
 * @deprecated Prefer `sortLinksHybrid` for mixed manual/automatic arrays.
 * This comparator is non-transitive when manual and automatic links are mixed.
 * Safe to use for arrays that are 100% manual OR 100% automatic.
 */
export const sortByEventDate = <T extends SortableLink>(a: T, b: T): number => {
  if (a.manual_order_override || b.manual_order_override) {
    return a.display_order - b.display_order;
  }

  const datetimeA = getDateTimeKey(a);
  const datetimeB = getDateTimeKey(b);

  if (datetimeA !== datetimeB) {
    return datetimeA.localeCompare(datetimeB);
  }
  return a.display_order - b.display_order;
};

/**
 * Two-pass hybrid sort.
 * - Automatic links are sorted by date (then display_order tiebreaker).
 * - Manual links are inserted at their display_order position (clamped).
 */
export const sortLinksHybrid = <T extends SortableLink>(links: T[]): T[] => {
  const automatic: T[] = [];
  const manual: T[] = [];

  for (const link of links) {
    if (link.manual_order_override) manual.push(link);
    else automatic.push(link);
  }

  automatic.sort((a, b) => {
    const dtA = getDateTimeKey(a);
    const dtB = getDateTimeKey(b);
    if (dtA !== dtB) return dtA.localeCompare(dtB);
    return a.display_order - b.display_order;
  });

  manual.sort((a, b) => a.display_order - b.display_order);

  const result: T[] = [...automatic];
  for (const m of manual) {
    const pos = Math.max(0, Math.min(m.display_order, result.length));
    result.splice(pos, 0, m);
  }
  return result;
};

/**
 * Filters out links for past events.
 */
export const isLinkForFutureEvent = <T extends SortableLink>(link: T, today: string): boolean => {
  const eventDate = link.override_date || link.events?.date;
  if (!eventDate) return true;
  return eventDate >= today;
};

/**
 * Processes links array: filters past/disabled events and applies hybrid sort.
 */
export const processLinksForDisplay = <T extends SortableLink & { enabled: boolean }>(
  links: T[]
): T[] => {
  const today = new Date().toISOString().split('T')[0];
  const filtered = links.filter((link) => link.enabled && isLinkForFutureEvent(link, today));
  return sortLinksHybrid(filtered);
};
