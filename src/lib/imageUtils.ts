/**
 * Utilitário para gerar URLs otimizadas de imagens do Supabase Storage.
 * Faz reescrita de domínio Supabase → Bunny CDN para cache de borda.
 */

const SUPABASE_STORAGE_PATTERN = /\/storage\/v1\/object\/public\//;

/**
 * Bunny CDN Pull Zone configurada como proxy do Supabase Storage.
 * Origin: https://xfvpuzlspvvsmmunznxw.supabase.co/storage/v1/object/public
 * O Bunny cacheia as imagens na borda, eliminando egress repetido do Supabase.
 */
const BUNNY_CDN_HOST = 'https://mdaccula.b-cdn.net';

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

  const imagePath = match[1];

  return `${BUNNY_CDN_HOST}/${imagePath}`;
}
