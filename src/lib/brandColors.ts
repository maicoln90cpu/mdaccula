/** Recognizable per-platform brand colors, applied only to icon glyphs (never card chrome). */
const brandColors: Record<string, string> = {
  instagram: "#E1306C",
  youtube: "#FF0000",
  twitter: "#1DA1F2",
  facebook: "#1877F2",
  linkedin: "#0A66C2",
  whatsapp: "#25D366",
  messagecircle: "#25D366",
  "message-circle": "#25D366",
  soundcloud: "#FF5500",
  music: "#FF5500",
  telegram: "#0088CC",
  send: "#0088CC",
};

export function getBrandColor(name: string): string | undefined {
  const key = name?.toLowerCase().replace(/\s+/g, "");
  return key ? brandColors[key] : undefined;
}
