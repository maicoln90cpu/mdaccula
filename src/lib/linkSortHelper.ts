/**
 * Helper function to sort links by event date
 * Priority: display_order for ALL links (respects manual positioning)
 * Manual links use their display_order directly
 * Automatic links are sorted by date first, then display_order as tiebreaker
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

/**
 * Sorts links respecting manual ordering
 * - Links with manual_order_override: sorted by display_order
 * - Links without: sorted by event date, with display_order as tiebreaker
 * - Manual links are positioned at their display_order among all links
 */
export const sortByEventDate = <T extends SortableLink>(a: T, b: T): number => {
  // If either has manual override, use display_order for that link
  // This ensures manual links appear in their exact position
  if (a.manual_order_override || b.manual_order_override) {
    return a.display_order - b.display_order;
  }
  
  // Both are automatic - sort by date
  const dateA = a.override_date || a.events?.date || '9999-12-31';
  const timeA = a.override_time || a.events?.time || '23:59';
  const dateB = b.override_date || b.events?.date || '9999-12-31';
  const timeB = b.override_time || b.events?.time || '23:59';
  
  const datetimeA = `${dateA}T${timeA}`;
  const datetimeB = `${dateB}T${timeB}`;
  
  if (datetimeA !== datetimeB) {
    return datetimeA.localeCompare(datetimeB);
  }
  
  return a.display_order - b.display_order;
};

/**
 * Filters out links for past events
 * @param link - The link to check
 * @param today - Today's date in ISO format (YYYY-MM-DD)
 * @returns true if the link should be shown, false if it's for a past event
 */
export const isLinkForFutureEvent = <T extends SortableLink>(link: T, today: string): boolean => {
  const eventDate = link.override_date || link.events?.date;
  
  if (!eventDate) {
    return true; // Links without dates are always shown
  }
  
  return eventDate >= today;
};

/**
 * Processes links array: filters past events and sorts by date
 * @param links - Array of links to process
 * @returns Processed array of links
 */
export const processLinksForDisplay = <T extends SortableLink & { enabled: boolean }>(
  links: T[]
): T[] => {
  const today = new Date().toISOString().split('T')[0];
  
  return links
    .filter(link => link.enabled && isLinkForFutureEvent(link, today))
    .sort(sortByEventDate);
};
