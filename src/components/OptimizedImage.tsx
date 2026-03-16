import { useState, useMemo } from 'react';
import { Skeleton } from './ui/skeleton';
import { getOptimizedImageUrl, getOriginalSupabaseUrl } from '@/lib/imageUtils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  sizes?: string;
  /** Local fallback image when both CDN and Supabase fail */
  fallbackImage?: string;
}

/**
 * Image component with automatic CDN → Supabase Storage fallback.
 * 
 * Flow:
 * 1. Try Bunny CDN URL (optimized)
 * 2. On error → try original Supabase Storage URL
 * 3. On second error → show fallbackImage or gradient placeholder
 */
export const OptimizedImage = ({ 
  src, 
  alt, 
  className = '',
  priority = false,
  objectFit = 'contain',
  fallbackImage,
}: OptimizedImageProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [triedSupabase, setTriedSupabase] = useState(false);

  const optimizedSrc = useMemo(() => {
    if (!src) return src;
    return getOptimizedImageUrl(src);
  }, [src]);

  const supabaseFallbackSrc = useMemo(() => {
    if (!optimizedSrc) return null;
    const supabaseUrl = getOriginalSupabaseUrl(optimizedSrc);
    // Only use as fallback if it's actually different from optimizedSrc
    return supabaseUrl !== optimizedSrc ? supabaseUrl : null;
  }, [optimizedSrc]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const currentSrc = e.currentTarget.src;
    console.warn(`[IMG_ERROR] OptimizedImage falha: ${currentSrc}`);

    // If we haven't tried Supabase yet and there's a Supabase fallback URL
    if (!triedSupabase && supabaseFallbackSrc) {
      setTriedSupabase(true);
      e.currentTarget.src = supabaseFallbackSrc;
      return;
    }

    // If we have a local fallback image, try that
    if (fallbackImage && currentSrc !== fallbackImage) {
      e.currentTarget.src = fallbackImage;
      setIsLoading(false);
      return;
    }

    // All attempts failed
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <Skeleton className="absolute inset-0 w-full h-full" />
      )}
      {hasError ? (
        <div className={`${className} flex items-center justify-center bg-gradient-to-br from-primary/20 via-muted/30 to-accent/20`}>
          <div className="text-center text-muted-foreground/60">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 mx-auto mb-1 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          </div>
        </div>
      ) : (
        <img
          src={optimizedSrc || src}
          alt={alt || 'MDAccula - Música Eletrônica'}
          className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
          style={{ objectFit }}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setIsLoading(false)}
          onError={handleError}
        />
      )}
    </div>
  );
};
