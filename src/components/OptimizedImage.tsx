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
      <img
        src={hasError ? '/placeholder.svg' : src}
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
    </div>
  );
};
