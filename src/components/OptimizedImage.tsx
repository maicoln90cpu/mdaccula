import { useState, useMemo } from 'react';
import { Skeleton } from './ui/skeleton';
import { getOptimizedImageUrl } from '@/lib/imageUtils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  sizes?: string;
}

/**
 * Simplified image component — single request, no fallback chain.
 * Fallback logic was removed because CDN→Supabase retries were doubling egress.
 */
export const OptimizedImage = ({ 
  src, 
  alt, 
  className = '',
  priority = false,
  objectFit = 'contain',
}: OptimizedImageProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const optimizedSrc = useMemo(() => {
    if (!src) return src;
    return getOptimizedImageUrl(src);
  }, [src]);

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
          onError={() => { setIsLoading(false); setHasError(true); }}
        />
      )}
    </div>
  );
};
