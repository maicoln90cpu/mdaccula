/**
 * Utilitário para gerar URLs otimizadas de imagens do Supabase Storage.
 * Faz reescrita de domínio Supabase → Bunny CDN para cache de borda.
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  Este utilitário cuida APENAS de URL rewriting e otimização.   ║
 * ║  Transformações:                                               ║
 * ║    1. Redimensionar proporcionalmente (width param no CDN)     ║
 * ║    2. Converter formato (WebP/AVIF via Bunny Optimizer)        ║
 * ║    3. Ajustar qualidade (quality param)                        ║
 * ║                                                                ║
 * ║  A política de object-fit (cover vs contain) é definida        ║
 * ║  pelos componentes de UI, não por este utilitário.             ║
 * ║  Para /links: ver LinkCardImage.tsx (object-cover).            ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

const SUPABASE_STORAGE_PATTERN = /\/storage\/v1\/object\/public\//;

/**
 * Bunny CDN Pull Zone configurada como proxy do Supabase Storage.
 * Origin: https://xfvpuzlspvvsmmunznxw.supabase.co/storage/v1/object/public
 * O Bunny cacheia as imagens na borda, eliminando egress repetido do Supabase.
 */
const BUNNY_CDN_HOST = 'https://mdacula.b-cdn.net';

const SUPABASE_ORIGIN = 'https://xfvpuzlspvvsmmunznxw.supabase.co/storage/v1/object/public';

/**
 * Regex para extrair o path após /storage/v1/object/public/
 */
const SUPABASE_PATH_REGEX = /\/storage\/v1\/object\/public\/(.+)$/;

/**
 * Regex para extrair o path após o Bunny CDN host
 */
const BUNNY_PATH_REGEX = /^https:\/\/mdacula\.b-cdn\.net\/(.+)$/;

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

  // URLs do Bunny CDN já estão otimizadas
  if (url.startsWith(BUNNY_CDN_HOST)) return url;

  // Reescrever URLs do Supabase Storage → Bunny CDN
  if (SUPABASE_STORAGE_PATTERN.test(url)) {
    const match = url.match(SUPABASE_PATH_REGEX);
    if (!match) return url;

    let imagePath = match[1];

    // Strip legacy resize/dimension params
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
      // If URL parsing fails, continue with original path
    }

    return `${BUNNY_CDN_HOST}/${imagePath}`;
  }

  return url;
}

/**
 * Reverte uma URL do Bunny CDN para a URL original do Supabase Storage.
 * Usado como fallback quando o CDN falha (cache corrompido, purge pendente).
 * 
 * cdn.mdaccula.com/event-images/img.webp → supabase.co/.../event-images/img.webp
 */
export function getOriginalSupabaseUrl(url: string | null | undefined): string {
  if (!url) return '';
  
  const match = url.match(BUNNY_PATH_REGEX);
  if (match) {
    return `${SUPABASE_ORIGIN}/${match[1]}`;
  }
  
  // If it's already a Supabase URL or other URL, return as-is
  return url;
}

