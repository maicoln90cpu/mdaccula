/**
 * Utilitário para gerar URLs otimizadas de imagens do Supabase Storage.
 * Usa Supabase Image Transformation + Bunny CDN para cache de borda.
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
 * Ex: https://xfvpuzlspvvsmmunznxw.supabase.co/storage/v1/object/public/event-images/foto.webp
 * Captura: event-images/foto.webp
 */
const SUPABASE_PATH_REGEX = /\/storage\/v1\/object\/public\/(.+)$/;

/**
 * Transforma uma URL de imagem do Supabase Storage em uma URL otimizada
 * servida pelo Bunny CDN com parâmetros de Image Transformation.
 * 
 * Fluxo: Visitante → Bunny CDN (cache) → Supabase Storage (origin)
 * 
 * Para URLs que não são do Supabase, retorna a URL original.
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    resize?: 'cover' | 'contain' | 'fill';
  } = {}
): string {
  if (!url) return '';
  
  const { width = 600, quality = 75, height, resize } = options;

  // Only transform Supabase storage URLs
  if (!SUPABASE_STORAGE_PATTERN.test(url)) {
    return url;
  }

  // Extract the path after /storage/v1/object/public/
  const match = url.match(SUPABASE_PATH_REGEX);
  if (!match) return url;

  const imagePath = match[1];

  // Build Bunny CDN URL with Supabase Image Transformation query params
  const params = new URLSearchParams();
  params.set('width', String(width));
  if (height) params.set('height', String(height));
  params.set('quality', String(quality));
  // Only include resize when height is set (avoid cropping portrait images)
  if (height && resize) {
    params.set('resize', resize);
  }

  return `${BUNNY_CDN_HOST}/${imagePath}?${params.toString()}`;
}

/**
 * Presets comuns de tamanho para diferentes contextos
 */
export const IMAGE_PRESETS = {
  /** Cards de listagem (blog grid, eventos grid) */
  card: { width: 480, quality: 70 },
  /** Cards featured / destaque */
  featured: { width: 800, quality: 75 },
  /** Thumbnails pequenas (carousel, sidebar) */
  thumbnail: { width: 320, quality: 65 },
  /** Imagem de detalhe / hero */
  detail: { width: 1024, quality: 80 },
} as const;
