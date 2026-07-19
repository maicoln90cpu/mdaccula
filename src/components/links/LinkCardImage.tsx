import { useState } from 'react';
import { getOptimizedImageUrl, getThumbnailUrl, getOriginalSupabaseUrl } from '@/lib/imageUtils';
import { StaticIcon } from './StaticIcon';

interface LinkCardImageProps {
  /** Raw image URL (thumbnail_url or event image_url) */
  thumbnailUrl: string | null | undefined;
  /** Fallback image URL (e.g. event image when thumbnail fails) */
  fallbackUrl?: string | null;
  /** Alt text */
  alt: string;
  /** Icon name for fallback when no image */
  iconName?: string;
  /** Whether this is a featured/highlighted card */
  featured?: boolean;
  /** Skip CDN optimization (e.g. for local blob previews in forms) */
  skipOptimization?: boolean;
}

/**
 * Single source of truth for image rendering in link cards.
 * Used by SimpleLinkCard, SortableLinkCard, and CustomLinkForm preview.
 *
 * Rules:
 * - Fixed square container with overflow-hidden + rounded-lg
 * - Standard: w-16 h-16 | Featured: w-20 h-20 sm:w-24 sm:h-24
 * - img: w-full h-full object-contain
 * - On error: tries fallbackUrl, then shows icon
 */
export const LinkCardImage = ({
  thumbnailUrl,
  fallbackUrl,
  alt,
  iconName = 'ExternalLink',
  featured = false,
  skipOptimization = false,
}: LinkCardImageProps) => {
  const [imgError, setImgError] = useState(false);
  const rawImage = imgError ? fallbackUrl || null : thumbnailUrl || fallbackUrl || null;

  const optimizedFull = rawImage && !skipOptimization ? getOptimizedImageUrl(rawImage) : null;
  const resolvedImage = rawImage ? (skipOptimization ? rawImage : getThumbnailUrl(rawImage)) : null;

  const containerClass = featured ? 'w-20 h-20 sm:w-24 sm:h-24' : 'w-16 h-16';

  if (!resolvedImage) {
    return (
      <div
        className={`${containerClass} flex-shrink-0 rounded-lg bg-white/10 flex items-center justify-center`}
      >
        <StaticIcon name={iconName} className={featured ? 'w-8 h-8' : 'w-6 h-6'} />
      </div>
    );
  }

  return (
    <div className={`${containerClass} flex-shrink-0 rounded-lg overflow-hidden bg-white/10`}>
      <img
        src={resolvedImage}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={(e) => {
          const img = e.currentTarget;

          // 1) thumb (pode não existir pra imagens antigas) -> full no Bunny CDN
          if (optimizedFull && !img.dataset.triedFull && img.src !== optimizedFull) {
            img.dataset.triedFull = 'true';
            img.src = optimizedFull;
            return;
          }

          // 2) full no Bunny CDN -> Supabase Storage direto
          if (!img.dataset.triedSupabase) {
            const supabaseUrl = getOriginalSupabaseUrl(optimizedFull || img.src);
            if (supabaseUrl !== img.src) {
              img.dataset.triedSupabase = 'true';
              img.src = supabaseUrl;
              return;
            }
          }

          // 3) troca pra fallbackUrl (imagem diferente, ex: capa do evento vinculado)
          if (!imgError && fallbackUrl && fallbackUrl !== thumbnailUrl) {
            setImgError(true);
            return;
          }

          // 4) esgotou tudo — navegador mostra a imagem quebrada
        }}
        className="w-full h-full object-contain rounded-md"
      />
    </div>
  );
};
