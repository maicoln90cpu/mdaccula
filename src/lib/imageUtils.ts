/**
 * Utilitário para gerar URLs otimizadas de imagens do Supabase Storage.
 * Faz reescrita de domínio Supabase → Bunny CDN para cache de borda.
 * Inclui fallback automático CDN → Supabase quando o CDN falha.
 */

const SUPABASE_STORAGE_PATTERN = /\/storage\/v1\/object\/public\//;

const BUNNY_CDN_HOST = 'https://mdaccula.b-cdn.net';
const SUPABASE_ORIGIN = 'https://xfvpuzlspvvsmmunznxw.supabase.co/storage/v1/object/public';

const SUPABASE_PATH_REGEX = /\/storage\/v1\/object\/public\/(.+)$/;
const BUNNY_PATH_REGEX = /^https:\/\/mdaccula\.b-cdn\.net\/(.+)$/;

/**
 * Transforma uma URL de imagem do Supabase Storage em uma URL
 * servida pelo Bunny CDN (apenas reescrita de domínio).
 */
export function getOptimizedImageUrl(
  url: string | null | undefined
): string {
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
