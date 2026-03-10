/**
 * Utilitário para gerar URLs otimizadas de imagens do Supabase Storage.
 * Faz reescrita de domínio Supabase → Bunny CDN para cache de borda.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  REGRA DE OURO: NUNCA cortar imagens.                          ║
 * ║  Todas as transformações devem apenas:                         ║
 * ║    1. Redimensionar proporcionalmente (width param no CDN)     ║
 * ║    2. Converter formato (WebP/AVIF via Bunny Optimizer)        ║
 * ║    3. Ajustar qualidade (quality param)                        ║
 * ║  No CSS: usar sempre object-contain. NUNCA object-cover        ║
 * ║  em thumbnails ou cards. Containers devem adaptar-se à         ║
 * ║  proporção natural da imagem (sem altura fixa forçada).        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const SUPABASE_STORAGE_PATTERN = /\/storage\/v1\/object\/public\//;

/**
 * Bunny CDN Pull Zone configurada como proxy do Supabase Storage.
 * Origin: https://xfvpuzlspvvsmmunznxw.supabase.co/storage/v1/object/public
 * O Bunny cacheia as imagens na borda, eliminando egress repetido do Supabase.
 */
const BUNNY_CDN_HOST = 'https://cdn.mdaccula.com';

/**
 * Regex para extrair o path após /storage/v1/object/public/
 */
const SUPABASE_PATH_REGEX = /\/storage\/v1\/object\/public\/(.+)$/;

/**
 * Transforma uma URL de imagem do Supabase Storage em uma URL
 * servida pelo Bunny CDN (apenas reescrita de domínio, sem transformação).
 * 
 * Fluxo: Visitante → Bunny CDN (cache) → Supabase Storage (origin)
 * 
 * Para URLs que não são do Supabase, retorna a URL original.
 */
export function getOptimizedImageUrl(
  url: string | null | undefined
): string {
  if (!url) return '';

  // Only rewrite Supabase storage URLs
  if (!SUPABASE_STORAGE_PATTERN.test(url)) {
    return url;
  }

  // Extract the path after /storage/v1/object/public/
  const match = url.match(SUPABASE_PATH_REGEX);
  if (!match) return url;

  let imagePath = match[1];

  // Strip legacy resize/dimension params that cause cropping
  try {
    const hasQuery = imagePath.includes('?');
    if (hasQuery) {
      const [basePath, queryString] = imagePath.split('?');
      const params = new URLSearchParams(queryString);
      // Remove any forced dimension/resize params
      params.delete('width');
      params.delete('height');
      params.delete('resize');
      const remaining = params.toString();
      imagePath = remaining ? `${basePath}?${remaining}` : basePath;
    }
  } catch {
    // If URL parsing fails, continue with original path
  }

  const cdnUrl = `${BUNNY_CDN_HOST}/${imagePath}`;

  // Avoid duplicating quality param if already present
  if (imagePath.includes('quality=')) {
    return cdnUrl;
  }

  // Handle existing querystring
  const separator = imagePath.includes('?') ? '&' : '?';
  return `${cdnUrl}${separator}quality=75`;
}

/**
 * Gera URL de thumbnail redimensionada para cards pequenos.
 * Adiciona `&width=160` ao CDN URL para que o Bunny Optimizer
 * entregue a imagem já redimensionada (~15 KiB em vez de ~244 KiB).
 *
 * Usar apenas em imagens exibidas em tamanhos pequenos (w-14 a w-24).
 * Para imagens grandes (hero, avatar), usar `getOptimizedImageUrl`.
 */
export function getThumbnailUrl(
  url: string | null | undefined,
  width: number = 160,
): string {
  const optimized = getOptimizedImageUrl(url);
  if (!optimized) return '';

  // Only append width to CDN URLs (avoid breaking external URLs)
  if (!optimized.startsWith(BUNNY_CDN_HOST)) return optimized;

  const separator = optimized.includes('?') ? '&' : '?';
  return `${optimized}${separator}width=${width}`;
}
