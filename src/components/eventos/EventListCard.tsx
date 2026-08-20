/**
 * Card de evento na listagem do /eventos — extraído de src/pages/Eventos.tsx (Onda 17).
 */
import { memo } from 'react';
import { Calendar as CalendarIcon, Clock, Copy, Edit, MapPin, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import djImage from '@/assets/dj-performance.jpg';
import { formatEventDateRange } from '@/lib/dateUtils';
import { getOptimizedImageUrl, getThumbnailUrl, handleThumbImageFallback } from '@/lib/imageUtils';
import type { Event } from '@/types';
import { formatEventTime } from './eventosHelpers';

interface EventListCardProps {
  event: Event;
  index: number;
  isAdmin: boolean;
  onClick: (event: Event) => void;
  onEdit: (event: Event) => void;
  onDuplicate: (event: Event) => void;
  onSaveAsTemplate: (event: Event) => void;
}

export const EventListCard = memo(function EventListCard({
  event,
  index,
  isAdmin,
  onClick,
  onEdit,
  onDuplicate,
  onSaveAsTemplate,
}: EventListCardProps) {
  return (
    <Card
      className="event-card group cursor-pointer"
      style={{ animationDelay: `${index * 0.1}s` }}
      onClick={() => onClick(event)}
    >
      <div className="relative overflow-hidden rounded-t-lg aspect-[3/4] bg-muted/20">
        <img
          src={getThumbnailUrl(event.image_url) || djImage}
          alt={event.title}
          className="w-full h-full object-contain"
          loading="lazy"
          decoding="async"
          onError={(e) =>
            handleThumbImageFallback(
              e,
              getOptimizedImageUrl(event.image_url) || djImage,
              djImage
            )
          }
        />
        <div className="absolute top-4 left-4 flex flex-wrap gap-1">
          {event.genres &&
            event.genres.length > 0 &&
            event.genres.slice(0, 2).map((genre: string, idx: number) => (
              <Badge key={idx} className="bg-primary/20 text-primary border-primary/30">
                {genre}
              </Badge>
            ))}
        </div>
        {isAdmin && (
          <div className="absolute top-4 right-4 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(event);
              }}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onDuplicate(event);
              }}
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={(e) => {
                e.stopPropagation();
                onSaveAsTemplate(event);
              }}
            >
              <Save className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      <CardHeader className="pb-3">
        <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-2">
          {event.title}
        </CardTitle>
        <div className="flex items-center text-base font-semibold text-white mt-2">
          <CalendarIcon className="w-4 h-4 mr-2 text-primary" />
          {formatEventDateRange(event.date, event.end_date)}
        </div>
        {event.subtitle && (
          <p className="text-sm text-muted-foreground mt-2">{event.subtitle}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        <div className="space-y-1">
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock className="w-3 h-3 mr-1 text-secondary" />
            {formatEventTime(event.time)}
          </div>
          <div className="flex items-center text-xs text-muted-foreground truncate">
            <MapPin className="w-3 h-3 mr-1 text-accent shrink-0" />
            <span className="truncate">
              {event.venue}, {event.location_city} - {event.location_state}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground">Ver detalhes</span>
          <Button size="sm" className="h-7 text-xs" onClick={(e) => e.stopPropagation()}>
            Ver
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
