import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton loading component for /links page
 * Shows immediately while data loads for better perceived performance
 */
export const LinksSkeleton = () => (
  <div className="min-h-screen bg-background">
    <div className="w-full max-w-[650px] mx-auto px-4 py-24 pb-12">
      {/* Header Skeleton */}
      <div className="flex flex-col items-center mb-8">
        {/* Avatar */}
        <Skeleton className="w-28 h-28 md:w-32 md:h-32 rounded-full mb-4" />
        {/* Handle */}
        <Skeleton className="h-8 w-40 mb-4" />
        {/* Social Icons */}
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="w-10 h-10 rounded-full" />
          ))}
        </div>
      </div>

      {/* Group Title Skeleton */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <Skeleton className="h-7 w-32" />
      </div>

      {/* Link Cards Skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton
            key={i}
            className="h-[100px] w-full rounded-2xl"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>

      {/* Second Group Skeleton */}
      <div className="mt-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Skeleton className="h-7 w-28" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              className="h-[100px] w-full rounded-2xl"
              style={{ animationDelay: `${(i + 6) * 100}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  </div>
);
