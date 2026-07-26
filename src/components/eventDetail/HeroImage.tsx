import { getMediumUrl, getOptimizedImageUrl, getThumbnailUrl, handleImageFallback } from '@/lib/imageUtils';

export function HeroImage({ imageUrl, title }: { imageUrl: string; title: string }) {
  if (!imageUrl) return null;
  return (
    <div className="relative w-full h-[40vh] sm:h-[50vh] md:h-[60vh] rounded-xl overflow-hidden mb-6 sm:mb-8 shadow-lg bg-muted/20">
      <img
        src={getThumbnailUrl(imageUrl) || getOptimizedImageUrl(imageUrl)}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60"
        onError={(e) => {
          const full = getOptimizedImageUrl(imageUrl);
          if (e.currentTarget.src !== full) e.currentTarget.src = full;
        }}
      />
      <img
        src={getOptimizedImageUrl(imageUrl)}
        srcSet={`${getMediumUrl(imageUrl)} 800w, ${getOptimizedImageUrl(imageUrl)} 1920w`}
        sizes="100vw"
        alt={title}
        className="relative w-full h-full object-contain"
        loading="lazy"
        onError={(e) => {
          const img = e.currentTarget;
          if (img.srcset) {
            img.removeAttribute('srcset');
            img.src = getOptimizedImageUrl(imageUrl);
            return;
          }
          handleImageFallback(e);
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
    </div>
  );
}
