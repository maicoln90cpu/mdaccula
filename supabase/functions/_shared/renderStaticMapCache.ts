/**
 * Pré-renderiza imagens do Google Static Maps usadas em e-mails e as salva
 * no Bunny CDN. Cada imagem distinta é gerada apenas uma vez, reduzindo o
 * custo do Maps Static API de "por abertura de e-mail" para "por campanha".
 */

import { checkBunnyFile, uploadBytesToBunny } from "./bunnyUploadBytes.ts";
import { getStoragePublicUrl, storageGetFile, storageUploadFile } from "./mapImageStorage.ts";

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
    const u = new URL(url, "https://localhost");
    const latRaw = u.searchParams.get("lat");
    const lngRaw = u.searchParams.get("lng");
    if (latRaw === null || lngRaw === null) return null;

    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return null;
    }

    const zoom = Math.max(10, Math.min(19, Number(u.searchParams.get("zoom") || "15")));
    const w = Math.max(200, Math.min(640, Number(u.searchParams.get("w") || "600")));
    const h = Math.max(150, Math.min(400, Number(u.searchParams.get("h") || "300")));
    const rawStyle = u.searchParams.get("style") || "roadmap";
    const style = ["roadmap", "terrain", "satellite", "hybrid"].includes(rawStyle) ? rawStyle : "roadmap";
    const rawPinColor = (u.searchParams.get("pincolor") || "").trim();
    const pinColor = /^#[0-9a-fA-F]{6}$/.test(rawPinColor)
      ? rawPinColor
      : /^[a-zA-Z]+$/.test(rawPinColor)
      ? rawPinColor
      : "red";

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

export function buildMapPath(params: MapRenderParams): string {
  const h = hashParams(params);
  return `email-map-images/map-${h}-${params.lat.toFixed(4)}-${params.lng.toFixed(4)}-z${params.zoom}-${params.w}x${params.h}-${params.style}-${params.pinColor.replace("#", "")}.png`;
}

export type ResolvedMapImage =
  | { source: "bunny"; bunnyUrl: string }
  | { source: "storage"; bytes: ArrayBuffer; contentType: string; storageUrl: string }
  | { source: "generated"; bytes: ArrayBuffer; contentType: string; bunnyUrl: string };

/**
 * Fonte única de verdade do cache-first de mapas: Bunny CDN → Supabase
 * Storage (fallback quando o Bunny não confirma) → API do Google (só em
 * cache miss real, confirmado ausente ou indeterminado nos dois lugares).
 * Usada tanto pelo proxy público (render-static-map) quanto pelo
 * pré-aquecimento de campanhas (ensureCachedMapImage) — antes eram duas
 * implementações paralelas da mesma lógica, o que já causou dois bugs de
 * cache em produção.
 */
export async function resolveMapImage(
  params: MapRenderParams,
  generateImage: () => Promise<Response>,
): Promise<ResolvedMapImage> {
  const path = buildMapPath(params);
  const bunnyCheck = await checkBunnyFile(path);

  if (bunnyCheck === "exists") {
    return { source: "bunny", bunnyUrl: `https://mdaccula.b-cdn.net/${path}` };
  }

  const storageHit = await storageGetFile(path);
  if (storageHit) {
    // Self-heal: o Bunny não confirmou (ausente ou erro), mas o Storage tem —
    // repõe no Bunny em segundo plano pra próxima consulta já achar lá.
    uploadBytesToBunny(storageHit.bytes, path, storageHit.contentType).catch((err) => {
      console.warn(`[resolveMapImage] self-heal upload to Bunny failed for ${path}:`, err);
    });
    return {
      source: "storage",
      bytes: storageHit.bytes,
      contentType: storageHit.contentType,
      storageUrl: `${path}`,
    };
  }

  // Cache miss real: nem o Bunny confirmou, nem o Storage tem uma cópia.
  // Isso cobre tanto "nunca foi gerado" (bunnyCheck === 'not-found') quanto
  // "Bunny e Storage indisponíveis ao mesmo tempo" (bunnyCheck === 'error') —
  // não dá pra travar o mapa indefinidamente por uma falha de rede.
  const response = await generateImage();
  if (!response.ok) {
    const text = await response.text().catch(() => "unknown");
    throw new Error(`map image generation failed (${response.status}): ${text}`);
  }
  const contentType = response.headers.get("Content-Type") || "image/png";
  const buffer = await response.arrayBuffer();

  const { url: bunnyUrl } = await uploadBytesToBunny(buffer, path, contentType);
  storageUploadFile(buffer, path, contentType).catch((err) => {
    console.warn(`[resolveMapImage] Storage backup failed for ${path}:`, err);
  });

  return { source: "generated", bytes: buffer, contentType, bunnyUrl };
}

/**
 * Garante que a imagem do mapa exista no Bunny CDN (ou, se o Bunny estiver
 * indisponível, no Supabase Storage), retornando uma URL pública embutível
 * no HTML do e-mail.
 */
export async function ensureCachedMapImage(
  params: MapRenderParams,
  renderStaticMapUrl: string,
): Promise<string> {
  const resolved = await resolveMapImage(params, () => fetch(renderStaticMapUrl));
  if (resolved.source === "bunny" || resolved.source === "generated") {
    return resolved.bunnyUrl;
  }
  return getStoragePublicUrl(resolved.storageUrl);
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
      // O atributo src vem do HTML com "&" escapado como "&amp;" (ex.: escape()
      // do emailBlocks). URLSearchParams não decodifica entidades HTML, então
      // "&amp;" quebra o parsing dos parâmetros após o primeiro (lat funciona,
      // lng/zoom/etc. viram "amp;lng" e são perdidos). Decodifica antes de
      // parsear e de buscar a imagem — sem isso o cache nunca acontecia.
      const decodedUrl = url.replace(/&amp;/g, "&");
      const params = parseRenderStaticMapUrl(decodedUrl);
      if (!params) continue;
      const cachedUrl = await ensureCachedMapImage(params, decodedUrl);
      result = result.replaceAll(fullMatch, fullMatch.replaceAll(url, cachedUrl));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[cacheStaticMapImagesInHtml] failed to cache ${url}: ${msg}`);
      // Mantém a URL original para não quebrar o e-mail.
    }
  }
  return result;
}

/**
 * Wrapper defensivo: nunca lança e nunca bloqueia um envio de e-mail.
 * Em caso de erro inesperado, retorna o HTML original.
 */
export async function safeCacheStaticMapImagesInHtml(
  html: string,
  tag: string,
): Promise<string> {
  try {
    return await cacheStaticMapImagesInHtml(html);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[${tag}] safeCacheStaticMapImagesInHtml fallback: ${msg}`);
    return html;
  }
}
