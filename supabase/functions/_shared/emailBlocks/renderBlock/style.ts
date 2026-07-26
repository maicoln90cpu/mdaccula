// Estilos derivados de settings, compartilhados por todas as famílias de blocos.
// Extraído do topo do switch de renderBlock.ts (Onda 23).
import type { RenderContext } from "../types.ts";
import { escape } from "../utils.ts";

export interface RenderStyle {
  primary: string;
  accent: string;
  brand: string;
  gradient: string;
  solidPrimary: string;
}

export function computeStyle(settings: RenderContext["settings"]): RenderStyle {
  const primary = escape(settings.primary_color);
  const accent = escape(settings.accent_color);
  const brand = escape(settings.brand_name);
  const gradient = `linear-gradient(90deg, ${primary} 0%, ${accent} 50%, #2563eb 100%)`;
  return { primary, accent, brand, gradient, solidPrimary: primary };
}
