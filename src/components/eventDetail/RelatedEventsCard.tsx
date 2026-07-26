import { Link } from 'react-router-dom';
import { SpotlightCard } from '@/components/effects/SpotlightCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { parseLocalDate } from '@/lib/dateUtils';
import { getOptimizedImageUrl, getThumbnailUrl, handleThumbImageFallback } from '@/lib/imageUtils';
import type { EventDetailData } from './types';

export function RelatedEventsCard({
  events,
  genres,
}: {
  events: EventDetailData[];
  genres: string[];
}) {
  if (!events.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Eventos Similares</CardTitle>
        <CardDescription>
          Outros eventos de {(genres ?? []).join(', ') || 'música eletrônica'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {events.map((relatedEvent) => (
          <Link
            key={relatedEvent.id}
            to={`/eventos/${relatedEvent.slug}`}
            className="block group"
          >
            <SpotlightCard className="rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex gap-3 p-3">
                {relatedEvent.image_url && (
                  <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={getThumbnailUrl(relatedEvent.image_url)}
                      alt={relatedEvent.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                      onError={(e) =>
                        handleThumbImageFallback(e, getOptimizedImageUrl(relatedEvent.image_url))
                      }
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <h4 className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-2">
                    {relatedEvent.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {parseLocalDate(relatedEvent.date).toLocaleDateString('pt-BR')} •{' '}
                    {relatedEvent.venue}
                  </p>
                </div>
              </div>
            </SpotlightCard>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
