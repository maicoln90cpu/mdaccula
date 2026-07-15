export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface ExistingEventLike {
  title: string;
  date: string; // YYYY-MM-DD
}

export function isDuplicateEvent(
  candidate: { title: string; date: string },
  existing: ExistingEventLike[],
): boolean {
  const normalizedCandidate = normalizeTitle(candidate.title);
  return existing.some(
    (e) => e.date === candidate.date && normalizeTitle(e.title) === normalizedCandidate,
  );
}
