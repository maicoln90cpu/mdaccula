/**
 * Utilitário para gerar URLs otimizadas de imagens do Supabase Storage.
 * Usa Supabase Image Transformation para redimensionar e comprimir na edge.
 */

const SUPABASE_STORAGE_PATTERN = /\/storage\/v1\/object\/public\//;

/**
 * Transforma uma URL de imagem do Supabase Storage em uma URL otimizada
 * usando render/image (Image Transformation).
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
  
  const { width = 600, quality = 75, resize = 'cover', height } = options;

  // Only transform Supabase storage URLs
  if (!SUPABASE_STORAGE_PATTERN.test(url)) {
    return url;
  }

  // Replace /object/public/ with /render/image/public/ and add params
  const renderUrl = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  );

  const params = new URLSearchParams();
  params.set('width', String(width));
  if (height) params.set('height', String(height));
  params.set('quality', String(quality));
  params.set('resize', resize);

  const separator = renderUrl.includes('?') ? '&' : '?';
  return `${renderUrl}${separator}${params.toString()}`;
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
