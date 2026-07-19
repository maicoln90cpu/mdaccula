/**
 * Utilitário para gerar URLs otimizadas de imagens do Supabase Storage.
 * Faz reescrita de domínio Supabase → Bunny CDN para cache de borda.
 * Inclui fallback automático CDN → Supabase quando o CDN falha.
 */

const SUPABASE_STORAGE_PATTERN = /\/storage\/v1\/object\/public\//;

export const BUNNY_CDN_HOST = 'https://mdaccula.b-cdn.net';
const SUPABASE_ORIGIN = 'https://xfvpuzlspvvsmmunznxw.supabase.co/storage/v1/object/public';

const SUPABASE_PATH_REGEX = /\/storage\/v1\/object\/public\/(.+)$/;
const BUNNY_PATH_REGEX = /^https:\/\/mdaccula\.b-cdn\.net\/(.+)$/;

/**
 * Transforma uma URL de imagem do Supabase Storage em uma URL
 * servida pelo Bunny CDN (apenas reescrita de domínio).
 */
export function getOptimizedImageUrl(url: string | null | undefined): string {
  if (!url) return '';

  // URLs do Bunny CDN já estão otimizadas
  if (url.startsWith(BUNNY_CDN_HOST)) return url;

  // Rewrite Supabase Storage URLs → Bunny CDN
  if (SUPABASE_STORAGE_PATTERN.test(url)) {
    const match = url.match(SUPABASE_PATH_REGEX);
    if (!match) return url;

    let imagePath = match[1];
    try {
      if (imagePath.includes('?')) {
        const [basePath, queryString] = imagePath.split('?');
        const params = new URLSearchParams(queryString);
        params.delete('width');
        params.delete('height');
        params.delete('resize');
        const remaining = params.toString();
        imagePath = remaining ? `${basePath}?${remaining}` : basePath;
      }
    } catch {
      // continue with original path
    }
    return `${BUNNY_CDN_HOST}/${imagePath}`;
  }

  return url;
}

const VARIANT_SUFFIX_PATTERN = /-(thumb|medium)$/;

/**
 * Deriva a URL de uma variante reduzida (thumb/medium) a partir da URL
 * "full" já otimizada, inserindo um sufixo antes da extensão.
 * Não valida se a variante existe no CDN — caller deve tratar 404 (imagens
 * enviadas antes desta feature não têm variante e devem cair pro full).
 */
function getVariantUrl(url: string | null | undefined, suffix: 'thumb' | 'medium'): string {
  if (!url) return '';

  const optimized = getOptimizedImageUrl(url);
  if (!optimized) return optimized;

  // URLs externas (ex: thumbnail auto-buscado de metadata em custom_links)
  // não passam pelo Bunny — não há variante pra pedir, devolve como está.
  if (!optimized.startsWith(BUNNY_CDN_HOST)) return optimized;

  // Já tem sufixo de variante — idempotente, não duplica.
  if (VARIANT_SUFFIX_PATTERN.test(optimized.replace(/\.[a-zA-Z0-9]+$/, ''))) return optimized;

  const lastDot = optimized.lastIndexOf('.');
  const lastSlash = optimized.lastIndexOf('/');
  if (lastDot === -1 || lastDot < lastSlash) return optimized; // sem extensão, não dá pra sufixar com segurança

  return `${optimized.slice(0, lastDot)}-${suffix}${optimized.slice(lastDot)}`;
}

/**
 * URL da variante "thumb" (~400px) — usar em cards/ícones/grids pequenos.
 */
export function getThumbnailUrl(url: string | null | undefined): string {
  return getVariantUrl(url, 'thumb');
}

/**
 * URL da variante "medium" (~800px) — usar em heroes responsivos via srcset.
 */
export function getMediumUrl(url: string | null | undefined): string {
  return getVariantUrl(url, 'medium');
}

/**
 * Reverte uma URL do Bunny CDN para a URL original do Supabase Storage.
 * Usado como fallback quando o CDN falha.
 */
export function getOriginalSupabaseUrl(url: string | null | undefined): string {
  if (!url) return '';

  const match = url.match(BUNNY_PATH_REGEX);
  if (match) {
    return `${SUPABASE_ORIGIN}/${match[1]}`;
  }

  return url;
}

/**
 * Helper for <img> onError handlers: tries Supabase fallback first,
 * then a local fallback image.
 *
 * Usage:
 *   onError={(e) => handleImageFallback(e, djImage)}
 */
export function handleImageFallback(
  e: React.SyntheticEvent<HTMLImageElement>,
  localFallback?: string
): void {
  const img = e.currentTarget;
  const currentSrc = img.src;
  const dataTriedSupabase = img.dataset.triedSupabase;

  // Step 1: Try Supabase Storage fallback
  if (!dataTriedSupabase) {
    const supabaseUrl = getOriginalSupabaseUrl(currentSrc);
    if (supabaseUrl !== currentSrc) {
      console.warn(`[IMG_ERROR] CDN falhou, tentando Supabase: ${currentSrc}`);
      img.dataset.triedSupabase = 'true';
      img.src = supabaseUrl;
      return;
    }
  }

  // Step 2: Use local fallback
  if (localFallback && currentSrc !== localFallback) {
    console.warn(`[IMG_ERROR] Supabase também falhou, usando fallback local: ${currentSrc}`);
    img.src = localFallback;
    return;
  }

  // Step 3: All failed
  console.error(`[IMG_ERROR] Todas as fontes falharam para: ${currentSrc}`);
}

/**
 * Helper for <img> onError handlers rendering a thumb/medium variant:
 * tries the full-size Bunny CDN URL first, then falls through to the
 * normal handleImageFallback chain (Supabase → local fallback).
 *
 * Usage:
 *   <img src={getThumbnailUrl(url)} onError={(e) => handleThumbImageFallback(e, getOptimizedImageUrl(url))} />
 */
export function handleThumbImageFallback(
  e: React.SyntheticEvent<HTMLImageElement>,
  fullUrl: string,
  localFallback?: string
): void {
  const img = e.currentTarget;
  if (!img.dataset.triedFull && fullUrl && img.src !== fullUrl) {
    img.dataset.triedFull = 'true';
    console.warn(`[IMG_ERROR] Variante reduzida falhou, tentando full: ${img.src}`);
    img.src = fullUrl;
    return;
  }
  handleImageFallback(e, localFallback);
}
