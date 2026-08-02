/**
 * Pré-renderiza imagens do Google Static Maps usadas em e-mails e as salva
 * no Bunny CDN. Cada imagem distinta é gerada apenas uma vez, reduzindo o
 * custo do Maps Static API de "por abertura de e-mail" para "por campanha".
 */

import { bunnyFileExists, uploadBytesToBunny } from "./bunnyUploadBytes.ts";

export interface MapRenderParams {
  lat: number;
  lng: number;
  zoom: number;
  w: number;
  h: number;
  style: string;
  pinColor: string;
}

/**
 * Extrai parâmetros de uma URL do render-static-map.
 * Suporta URLs absolutas do Supabase Functions ou caminhos relativos.
 */
export function parseRenderStaticMapUrl(url: string): MapRenderParams | null {
  try {
    const u = new URL(url, "https://localhost"); // base fallback para caminhos relativos
    const lat = Number(u.searchParams.get("lat"));
    const lng = Number(u.searchParams.get("lng"));
    const zoom = Math.max(10, Math.min(19, Number(u.searchParams.get("zoom") || "15")));
    const w = Math.max(200, Math.min(640, Number(u.searchParams.get("w") || "600")));
    const h = Math.max(150, Math.min(400, Number(u.searchParams.get("h") || "300")));
    const style = ["roadmap", "terrain", "satellite", "hybrid"].includes(u.searchParams.get("style") || "roadmap")
      ? (u.searchParams.get("style") || "roadmap")
      : "roadmap";
    const rawPinColor = (u.searchParams.get("pincolor") || "").trim();
    const pinColor = /^#[0-9a-fA-F]{6}$/.test(rawPinColor)
      ? rawPinColor
      : /^[a-zA-Z]+$/.test(rawPinColor)
      ? rawPinColor
      : "red";

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return null;
    }
    return { lat, lng, zoom, w, h, style, pinColor };
  } catch {
    return null;
  }
}

function hashParams(params: MapRenderParams): string {
  const data = `${params.lat.toFixed(6)},${params.lng.toFixed(6)},${params.zoom},${params.w}x${params.h},${params.style},${params.pinColor}`;
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

function buildMapPath(params: MapRenderParams): string {
  const h = hashParams(params);
  return `email-map-images/map-${h}-${params.lat.toFixed(4)}-${params.lng.toFixed(4)}-z${params.zoom}-${params.w}x${params.h}-${params.style}-${params.pinColor.replace("#", "")}.png`;
}

/**
 * Garante que a imagem do mapa exista no Bunny CDN, retornando a URL pública.
 * Se já existir, reutiliza; se não, chama o render-static-map e faz upload.
 */
export async function ensureCachedMapImage(
  params: MapRenderParams,
  renderStaticMapUrl: string,
): Promise<string> {
  const path = buildMapPath(params);
  if (await bunnyFileExists(path)) {
    return `https://mdaccula.b-cdn.net/${path}`;
  }

  const response = await fetch(renderStaticMapUrl);
  if (!response.ok) {
    const text = await response.text().catch(() => "unknown");
    throw new Error(`render-static-map failed (${response.status}): ${text}`);
  }
  const contentType = response.headers.get("Content-Type") || "image/png";
  const buffer = await response.arrayBuffer();
  const { url } = await uploadBytesToBunny(buffer, path, contentType);
  return url;
}

/**
 * Recebe o HTML do e-mail e substitui todas as URLs do render-static-map
 * por URLs do Bunny CDN. Não lança — em caso de falha, retorna o HTML
 * original e loga o erro.
 */
export async function cacheStaticMapImagesInHtml(html: string): Promise<string> {
  if (!html.includes("render-static-map")) return html;

  const imgUrlRegex = /<img[^>]+src=["']([^"']*render-static-map[^"']*)["'][^>]*>/gi;
  const matches: Array<{ fullMatch: string; url: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = imgUrlRegex.exec(html)) !== null) {
    matches.push({ fullMatch: match[0], url: match[1] });
  }
  if (matches.length === 0) return html;

  let result = html;
  for (const { fullMatch, url } of matches) {
    try {
      const params = parseRenderStaticMapUrl(url);
      if (!params) continue;
      const cachedUrl = await ensureCachedMapImage(params, url);
      result = result.replaceAll(fullMatch, fullMatch.replaceAll(url, cachedUrl));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[cacheStaticMapImagesInHtml] failed to cache ${url}: ${msg}`);
      // Mantém a URL original para não quebrar o e-mail.
    }
  }
  return result;
}
