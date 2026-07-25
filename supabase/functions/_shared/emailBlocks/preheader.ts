// Preheader (texto de preview do inbox).
import type { EventAnnouncementData } from "./types.ts";

export function computePreheader(event: EventAnnouncementData): string {
  const t = (event.eventTitle || "").trim();
  const d = (event.dateLabel || "").trim();
  const v = (event.venueName || "").trim();
  const c = (event.cityState || "").trim();
  const parts = [t];
  if (d) parts.push(d);
  if (v || c) parts.push([v, c].filter(Boolean).join(", "));
  return parts.filter(Boolean).join(" — ").slice(0, 150);
}
