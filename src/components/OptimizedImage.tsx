import { useState, useMemo } from 'react';
import { Skeleton } from './ui/skeleton';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  sizes?: string;
  widths?: number[];
}

// Default breakpoint widths for srcset
const DEFAULT_WIDTHS = [320, 640, 768, 1024, 1280, 1920];

// Check if URL is from Supabase storage (supports transformations)
const isSupabaseStorageUrl = (url: string): boolean => {
  return url.includes('supabase.co/storage') || url.includes('supabase.in/storage');
};

// Generate srcset for Supabase storage images
const generateSupabaseSrcset = (src: string, widths: number[]): string => {
  return widths
    .map((width) => {
      // Supabase storage transformation URL format
      const separator = src.includes('?') ? '&' : '?';
      return `${src}${separator}width=${width} ${width}w`;
    })
    .join(', ');
};

// Generate srcset for generic images (just returns original)
const generateGenericSrcset = (src: string, widths: number[]): string | undefined => {
  // For non-Supabase images, we can't generate different sizes
  // Return undefined to skip srcset
  return undefined;
};

export const OptimizedImage = ({ 
  src, 
  alt, 
  className = '',
  priority = false,
  objectFit = 'cover',
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  widths = DEFAULT_WIDTHS
}: OptimizedImageProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const srcset = useMemo(() => {
    if (!src || hasError) return undefined;
    
    if (isSupabaseStorageUrl(src)) {
      return generateSupabaseSrcset(src, widths);
    }
    
    return generateGenericSrcset(src, widths);
  }, [src, widths, hasError]);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
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
          src={src}
          srcSet={srcset}
          sizes={srcset ? sizes : undefined}
          alt={alt || 'MDAccula - Música Eletrônica'}
          className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
          style={{ objectFit }}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </div>
  );
};
